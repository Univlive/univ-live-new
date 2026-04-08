import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
} from "@google/generative-ai";
import { initializeStreaming, sendStreamEvent, endStreaming, streamError } from "../_lib/aiStreamingUtils";

// ---------------------------------------------------------------------------
// Request types (from frontend)
// ---------------------------------------------------------------------------

interface QuestionData {
  id: string;
  text: string;
  type: "mcq" | "integer";
  options?: string[];
  correctOptionIndex?: number;
  correctAnswer?: string | number;
  explanation?: string;
  section?: string;
  marks?: number;
}

interface UserResponse {
  questionId: string;
  userAnswer: string | null;
  isCorrect: boolean;
  marks?: number;
}

interface AnalysisRequest {
  questions: QuestionData[];
  responses: UserResponse[];
  testTitle: string;
  subject: string;
  totalScore: number;
  maxScore: number;
  accuracy: number;
}

// ---------------------------------------------------------------------------
// Response type (consumed by AIReviewPanel on the frontend)
// ---------------------------------------------------------------------------

interface AnalysisResponse {
  overallAnalysis: string;
  weakAreas: string[];
  strengths: string[];
  prerequisites: Array<{
    topic: string;
    importance: "high" | "medium" | "low";
    relatedQuestions: string[];
    description: string;
  }>;
  topicMapping: Array<{
    topic: string;
    questionsItCovers: string[];
    estimatedMarksGain: number;
    difficulty: "beginner" | "intermediate" | "advanced";
  }>;
  marksProjection: {
    currentScore: number;
    potentialScore: number;
    improvementAreas: Array<{
      topic: string;
      possibleMarksGain: number;
      effort: "easy" | "medium" | "hard";
    }>;
  };
  suggestions: string[];
  nextTestRecommendations: string[];
}

// ---------------------------------------------------------------------------
// Gemini response schema – enforces strict JSON matching AnalysisResponse
// ---------------------------------------------------------------------------

const analysisSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overallAnalysis: { type: SchemaType.STRING },
    weakAreas: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    strengths: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    prerequisites: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          topic: { type: SchemaType.STRING },
          importance: {
            type: SchemaType.STRING,
            enum: ["high", "medium", "low"],
          },
          relatedQuestions: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          description: { type: SchemaType.STRING },
        },
        required: ["topic", "importance", "relatedQuestions", "description"],
      },
    },
    topicMapping: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          topic: { type: SchemaType.STRING },
          questionsItCovers: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          estimatedMarksGain: { type: SchemaType.NUMBER },
          difficulty: {
            type: SchemaType.STRING,
            enum: ["beginner", "intermediate", "advanced"],
          },
        },
        required: [
          "topic",
          "questionsItCovers",
          "estimatedMarksGain",
          "difficulty",
        ],
      },
    },
    marksProjection: {
      type: SchemaType.OBJECT,
      properties: {
        currentScore: { type: SchemaType.NUMBER },
        potentialScore: { type: SchemaType.NUMBER },
        improvementAreas: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              topic: { type: SchemaType.STRING },
              possibleMarksGain: { type: SchemaType.NUMBER },
              effort: {
                type: SchemaType.STRING,
                enum: ["easy", "medium", "hard"],
              },
            },
            required: ["topic", "possibleMarksGain", "effort"],
          },
        },
      },
      required: ["currentScore", "potentialScore", "improvementAreas"],
    },
    suggestions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    nextTestRecommendations: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: [
    "overallAnalysis",
    "weakAreas",
    "strengths",
    "prerequisites",
    "topicMapping",
    "marksProjection",
    "suggestions",
    "nextTestRecommendations",
  ],
} as const;

// ---------------------------------------------------------------------------
// System instruction for Gemini
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = [
  "You are an expert educational analyst for competitive exam preparation in India.",
  "You analyze student test performance and provide detailed, actionable insights.",
  "",
  "Your analysis must be:",
  "- Specific: Reference actual question numbers (Q1, Q2, etc.) and topics.",
  "- Actionable: Give concrete study advice, not vague platitudes.",
  "- Accurate: Base marks projections on real data — do not inflate or fabricate numbers.",
  "- Encouraging: Acknowledge strengths before addressing weaknesses.",
  "",
  "Guidelines for each field:",
  "- overallAnalysis: 2-3 sentences summarizing performance, score context, and key takeaway.",
  "- strengths: List 3-5 specific areas where the student performed well.",
  "- weakAreas: List 3-5 specific topics/concepts where the student struggled.",
  "- prerequisites: Foundational concepts the student is missing that caused incorrect answers.",
  "  Each prerequisite must reference the related question numbers (e.g. 'Q3, Q7').",
  "- topicMapping: Topics to study, which questions they cover, estimated marks gain, and difficulty.",
  "  estimatedMarksGain must not exceed the actual marks lost on those questions.",
  "- marksProjection: currentScore = the student's actual score. potentialScore = realistic max",
  "  if they master the identified topics (cap at maxScore). improvementAreas should sum to",
  "  potentialScore - currentScore.",
  "- suggestions: 4-6 concrete study tips tailored to this student's performance.",
  "- nextTestRecommendations: 2-4 test names the student should take next.",
].join("\n");

// ---------------------------------------------------------------------------
// Build the analysis prompt from test data
// ---------------------------------------------------------------------------

function buildAnalysisPrompt(
  questions: QuestionData[],
  responses: UserResponse[],
  testTitle: string,
  subject: string,
  totalScore: number,
  maxScore: number,
  accuracy: number
): string {
  const incorrectResponses = responses.filter((r) => !r.isCorrect);

  const questionsText = questions
    .map((q, idx) => {
      const response = responses.find((r) => r.questionId === q.id);
      const status = response?.isCorrect ? "✓ CORRECT" : "✗ INCORRECT";
      return [
        `Q${idx + 1} [${status}] (${q.marks || 5} marks):`,
        `Text: ${q.text}`,
        q.options ? `Options: ${q.options.join(" | ")}` : "",
        q.type === "integer" ? "Type: Numerical" : "",
        `Section: ${q.section || "General"}`,
        `Student's Answer: ${response?.userAnswer || "Not answered"}`,
        `Correct Answer: ${q.type === "integer" ? q.correctAnswer : (q.options?.[q.correctOptionIndex ?? 0] || q.correctAnswer)}`,
        q.explanation ? `Explanation: ${q.explanation}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n---\n");

  return [
    "ANALYZE THIS TEST PERFORMANCE:",
    `Test: ${testTitle} (${subject})`,
    `Score: ${totalScore}/${maxScore} (${accuracy}% accuracy)`,
    `Total Questions: ${questions.length}`,
    `Incorrect: ${incorrectResponses.length}`,
    "",
    "QUESTIONS AND RESPONSES:",
    questionsText,
    "",
    "Provide a comprehensive analysis covering:",
    "1. Where the student is lagging (based on incorrect answers)",
    "2. The basic prerequisites/concepts they're missing",
    "3. Which topics cover each prerequisite",
    "4. Exact marks that can be gained by mastering those topics",
    "5. Difficulty level for each topic",
    "6. Effort required to improve",
    "",
    "Be specific — reference question numbers and explain the root cause of each wrong answer.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Call Gemini 1.5 Flash with structured output
// ---------------------------------------------------------------------------

async function analyzeWithGemini(
  prompt: string
): Promise<AnalysisResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const generationConfig: GenerationConfig = {
    temperature: 0.7,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseSchema: analysisSchema as any, // SDK typing requires cast
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
  const parsed = JSON.parse(text) as AnalysisResponse;

  // Sanity-check the top-level shape
  if (!parsed || typeof parsed.overallAnalysis !== "string") {
    throw new Error(
      "Gemini response did not match expected schema (missing 'overallAnalysis')"
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
      questions,
      responses,
      testTitle,
      subject,
      totalScore,
      maxScore,
      accuracy,
    } = req.body as AnalysisRequest;

    // ---- Input Validation ----
    if (!questions || !Array.isArray(questions) || !questions.length) {
      return streamError(res, new Error("Missing or empty required field: questions"));
    }

    if (!responses || !Array.isArray(responses)) {
      return streamError(res, new Error("Missing required field: responses"));
    }

    if (!process.env.GEMINI_API_KEY) {
      return streamError(res, new Error("GEMINI_API_KEY is not configured"));
    }

    sendStreamEvent(res, {
      type: "progress",
      message: `Analyzing your performance on ${testTitle || "this test"}...`,
    });

    // ---- Build prompt with full test data ----
    // Gemini 1.5 Flash handles 1M tokens — no chunking/batching needed
    const prompt = buildAnalysisPrompt(
      questions,
      responses,
      testTitle || "Unknown Test",
      subject || "General",
      totalScore ?? 0,
      maxScore ?? 0,
      accuracy ?? 0
    );

    console.log(
      `[analyze-performance] Analyzing "${testTitle}" — ${questions.length} questions, score ${totalScore}/${maxScore}`
    );

    sendStreamEvent(res, {
      type: "progress",
      message: "Identifying weak areas and strong concepts...",
    });

    // ---- Call Gemini ----
    const analysis = await analyzeWithGemini(prompt);

    console.log(
      `[analyze-performance] Analysis complete — ${analysis.weakAreas.length} weak areas, ` +
      `${analysis.prerequisites.length} prerequisites, ` +
      `projection ${analysis.marksProjection.currentScore} → ${analysis.marksProjection.potentialScore}`
    );

    sendStreamEvent(res, {
      type: "progress",
      message: "Generating personalized study recommendations...",
    });

    // Send the complete analysis
    sendStreamEvent(res, {
      type: "complete",
      data: analysis,
    });

    endStreaming(res);
  } catch (error) {
    console.error("[analyze-performance] Unhandled error:", error);
    streamError(res, error);
  }
}
