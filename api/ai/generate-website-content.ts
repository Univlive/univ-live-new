import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
} from "@google/generative-ai";
import { initializeStreaming, sendStreamEvent, endStreaming, streamError, getUserFriendlyErrorMessage } from "../_lib/aiStreamingUtils";

// ---------------------------------------------------------------------------
// Request type (from frontend WebsiteSettings.tsx)
// ---------------------------------------------------------------------------

interface WebsiteContentRequest {
  coachingName: string;
  educatorName: string;
  subjects: string[];
  description: string;
  yearEstablished?: number;
  studentCount?: number;
}

// ---------------------------------------------------------------------------
// Gemini response schema – enforces strict JSON output
// ---------------------------------------------------------------------------

const websiteContentSchema = {
  type: SchemaType.OBJECT,
  properties: {
    heroTagline: {
      type: SchemaType.STRING,
      description: "A catchy, short one-liner for the top of the website.",
    },
    aboutUs: {
      type: SchemaType.STRING,
      description:
        "A professional 2-3 paragraph description of the coaching center.",
    },
    stats: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: {
            type: SchemaType.STRING,
            description:
              "e.g., 'Students Selected', 'Years Experience', 'Success Rate'",
          },
          value: {
            type: SchemaType.STRING,
            description: "e.g., '10,000+', '15+', '95%'",
          },
          icon: {
            type: SchemaType.STRING,
            description:
              "A Lucide icon name: 'Users', 'Trophy', 'Star', 'BookOpen', 'Target', 'Award', 'TrendingUp'",
          },
        },
        required: ["label", "value", "icon"],
      },
    },
    achievements: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          icon: {
            type: SchemaType.STRING,
            description: "A Lucide icon name: 'Trophy', 'Award', 'Star', 'Medal'",
          },
        },
        required: ["title", "description", "icon"],
      },
    },
    testimonials: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          course: {
            type: SchemaType.STRING,
            description: "The course/subject the student studied.",
          },
          rating: {
            type: SchemaType.NUMBER,
            description: "Rating from 1 to 5.",
          },
          text: { type: SchemaType.STRING },
          avatar: {
            type: SchemaType.STRING,
            description:
              "The student's initials as a placeholder, e.g. 'RK' for 'Rahul Kumar'.",
          },
        },
        required: ["name", "course", "rating", "text", "avatar"],
      },
    },
    faculty: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          subject: { type: SchemaType.STRING },
          designation: {
            type: SchemaType.STRING,
            description: "e.g., 'Senior Faculty', 'Head of Department'",
          },
          experience: {
            type: SchemaType.STRING,
            description: "e.g., '10+ Years'",
          },
          bio: {
            type: SchemaType.STRING,
            description: "A short, 2-sentence professional bio.",
          },
          image: {
            type: SchemaType.STRING,
            description:
              "Placeholder initials, e.g. 'RK' for 'Rajesh Kumar'.",
          },
        },
        required: ["name", "subject", "designation", "experience", "bio", "image"],
      },
    },
  },
  required: [
    "heroTagline",
    "aboutUs",
    "stats",
    "achievements",
    "testimonials",
    "faculty",
  ],
} as const;

// ---------------------------------------------------------------------------
// System instruction for Gemini
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = [
  "You are an expert website content creator for educational coaching centers in India.",
  "Generate engaging, professional, and realistic marketing content based on the educator's input.",
  "",
  "Guidelines:",
  "- heroTagline: A catchy, motivational one-liner (max 10 words).",
  "- aboutUs: Professional 2-3 paragraphs describing the coaching center's mission, methodology, and USP.",
  "- stats: 4-5 key achievement stats (e.g., '1000+ Students', '95% Success Rate', '10+ Years').",
  "  Use icon names from Lucide: 'Users', 'Trophy', 'Star', 'BookOpen', 'Target', 'Award', 'TrendingUp'.",
  "- achievements: 3-5 awards, recognitions, or certifications. Include icon names.",
  "- testimonials: 3-4 realistic student reviews with ratings 4-5. Use initials as avatar placeholders.",
  "  Make them specific to the subjects offered.",
  "- faculty: Include the main educator plus 1-2 additional faculty. Use initials as image placeholders.",
  "  Each bio should be exactly 2 sentences.",
  "",
  "Be specific to the subjects mentioned. Do NOT use generic placeholder text.",
  "Make the content sound authentic and professional — suitable for a real coaching website.",
].join("\n");

// ---------------------------------------------------------------------------
// Build the content generation prompt
// ---------------------------------------------------------------------------

function buildPrompt(
  coachingName: string,
  educatorName: string,
  subjects: string[],
  description: string,
  yearEstablished?: number,
  studentCount?: number
): string {
  const subjectsText = subjects.join(", ");
  const yearsActive = yearEstablished
    ? new Date().getFullYear() - yearEstablished
    : null;
  const studentInfo = studentCount
    ? `with approximately ${studentCount} students enrolled`
    : "";

  return [
    "Generate professional website content for this coaching center:",
    "",
    `Coaching Center Name: ${coachingName}`,
    `Founder/Educator: ${educatorName}`,
    `Subjects: ${subjectsText}`,
    yearsActive !== null ? `Years Active: ${yearsActive} years` : "",
    studentInfo ? `Student Info: ${studentInfo}` : "",
    "",
    `Description: ${description}`,
    "",
    "Create realistic, professional content that would appeal to students looking to join.",
    "The content should reflect the subjects offered and the coaching center's mission.",
    "Make testimonials specific to the subjects and align achievements with common educational milestones.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Call Gemini 1.5 Flash with structured output
// ---------------------------------------------------------------------------

async function generateWithGemini(prompt: string): Promise<Record<string, any>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const generationConfig: GenerationConfig = {
    temperature: 0.8,
    maxOutputTokens: 4096,
    responseMimeType: "application/json",
    responseSchema: websiteContentSchema as any, // SDK typing requires cast
  };

  const model = genAI.getGenerativeModel({
    model: `${process.env.GEMINI_MODEL}`,
    generationConfig,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const result = await model.generateContent(prompt);

  const text = result.response.text();
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  // With responseSchema, Gemini guarantees valid JSON — no regex needed
  const parsed = JSON.parse(text);

  // Sanity-check
  if (!parsed || typeof parsed.heroTagline !== "string") {
    throw new Error(
      "Gemini response did not match expected schema (missing 'heroTagline')"
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Main Vercel handler
// ---------------------------------------------------------------------------

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Initialize streaming response
  initializeStreaming(res);

  try {
    const {
      coachingName,
      educatorName,
      subjects,
      description,
      yearEstablished,
      studentCount,
    } = req.body as WebsiteContentRequest;

    // ---- Input Validation ----
    if (!coachingName || !educatorName || !subjects || !description) {
      return streamError(res, new Error("Missing required fields: coachingName, educatorName, subjects, description"));
    }

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return streamError(res, new Error("subjects must be a non-empty array of strings"));
    }

    if (!process.env.GEMINI_API_KEY) {
      return streamError(res, new Error("GEMINI_API_KEY is not configured"));
    }

    sendStreamEvent(res, {
      type: "progress",
      message: `Preparing content generation for ${coachingName}...`,
    });

    // ---- Build prompt ----
    const prompt = buildPrompt(
      coachingName,
      educatorName,
      subjects,
      description,
      yearEstablished,
      studentCount
    );

    console.log(
      `[generate-website-content] Generating content for "${coachingName}" — subjects: ${subjects.join(", ")}`
    );

    sendStreamEvent(res, {
      type: "progress",
      message: `Generating creative content for ${subjects.join(", ")}...`,
    });

    // ---- Call Gemini ----
    const content = await generateWithGemini(prompt);

    console.log(
      `[generate-website-content] Generated: ${content.stats?.length || 0} stats, ` +
      `${content.achievements?.length || 0} achievements, ` +
      `${content.testimonials?.length || 0} testimonials, ` +
      `${content.faculty?.length || 0} faculty`
    );

    sendStreamEvent(res, {
      type: "progress",
      message: "Processing and finalizing content...",
    });

    // Send the complete content
    sendStreamEvent(res, {
      type: "complete",
      data: content,
    });

    endStreaming(res);
  } catch (error) {
    console.error("[generate-website-content] Unhandled error:", error);
    streamError(res, error);
  }
}
