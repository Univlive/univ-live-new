import { VercelRequest, VercelResponse } from "@vercel/node";

// ---------------------------------------------------------------------------
// Vercel Serverless Config – raise body parser limit from default 1 MB to 10 MB
// so that large Base64-encoded page images are accepted without a 413 error.
// ---------------------------------------------------------------------------
export const config = {
  maxDuration: 120, // Allow longer processing for dense pages with many questions
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

// NOTE: GoogleGenerativeAI is lazy-loaded to prevent module load crashes
// Type imports are OK at top-level since they're erased at runtime
import type {
  GenerationConfig,
} from "@google/generative-ai";
import {
  normalizeImportedItem,
  type ImportedQuestionItem,
} from "../_lib/pdfQuestionImport.js";
import { initializeStreaming, sendStreamEvent, endStreaming, streamError } from "../_lib/aiStreamingUtils.js";
import { getGeminiModelNameFromEnv } from "../_lib/geminiModel.js";
import ImageKit from "imagekit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportRequest = {
  /** Base64-encoded JPEG/PNG image of a single PDF page */
  imageBase64: string;
  /** Original MIME type of the image (default: image/png) */
  imageMimeType?: string;
  /** Optional text extracted from the same PDF page for anti-hallucination checks */
  pageText?: string;
  fileName?: string;
  /** Which page of the PDF this image represents (1-indexed) */
  pageNumber?: number;
  testTitle?: string;
  subject?: string;
  /** Educator UID – used to namespace uploads in Firebase Storage */
  educatorId?: string;
};



type GeminiMcqItem = {
  sourceIndex: number;
  status: "ready" | "partial" | "rejected";
  question: string;
  options: {
    a?: string;
    b?: string;
    c?: string;
    d?: string;
  } | string[];
  correctOption: number | null;
  reasons: string[];
  rawBlock: string;
  questionImageBox: number[]; // [ymin, xmin, ymax, xmax] scaled 0..1000
};

type GeminiResponse = {
  items: GeminiMcqItem[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

/** Maximum decoded image size: ~15 MB (Base64 encodes ~33% larger) */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Padding percentage applied to each side of a bounding box crop */
const BBOX_PAD_PERCENT = 0.1;

let sharpLoader: Promise<any> | null = null;

async function getSharp() {
  try {
    if (!sharpLoader) {
      sharpLoader = import("sharp") as Promise<any>;
    }
    const mod = await sharpLoader;
    return mod?.default ?? mod;
  } catch (err) {
    console.error("[getSharp] Error loading sharp:", err);
    throw err;
  }
}

async function getFirebaseAdmin() {
  try {
    const mod = await import("../_lib/firebaseAdmin.js");
    return mod.getAdmin();
  } catch (err) {
    console.error("[getFirebaseAdmin] Error loading Firebase admin:", err);
    throw err;
  }
}

let geminiLoader: Promise<any> | null = null;

async function getGeminiAI() {
  try {
    if (!geminiLoader) {
      geminiLoader = import("@google/generative-ai") as Promise<any>;
    }
    const mod = await geminiLoader;
    return mod;
  } catch (err) {
    console.error("[getGeminiAI] Error loading GoogleGenerativeAI:", err);
    throw err;
  }
}

// Helper to get SchemaType from the Gemini module
async function getSchemaType() {
  try {
    const mod = await getGeminiAI();
    return mod.SchemaType;
  } catch (err) {
    console.error("[getSchemaType] Error getting SchemaType:", err);
    throw err;
  }
}

// Build MCQ response schema dynamically to avoid top-level async
async function buildMcqSchema() {
  const SchemaType = await getSchemaType();
  
  return {
    type: SchemaType.OBJECT,
    properties: {
      items: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            sourceIndex: { type: SchemaType.NUMBER },
            status: {
              type: SchemaType.STRING,
              enum: ["ready", "partial", "rejected"],
            },
            question: { type: SchemaType.STRING },
            options: {
              type: SchemaType.OBJECT,
              properties: {
                a: { type: SchemaType.STRING },
                b: { type: SchemaType.STRING },
                c: { type: SchemaType.STRING },
                d: { type: SchemaType.STRING },
              },
              required: ["a", "b", "c", "d"],
            },
            correctOption: { type: SchemaType.NUMBER, nullable: true },
            reasons: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            rawBlock: { type: SchemaType.STRING },
            questionImageBox: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.NUMBER },
              description:
                "If a diagram/image/figure exists for this question, return bounding box " +
                "[ymin, xmin, ymax, xmax] scaled 0-1000. Otherwise, empty array.",
            },
          },
          required: [
            "sourceIndex",
            "status",
            "question",
            "options",
            "reasons",
            "rawBlock",
            "questionImageBox",
          ],
        },
      },
    },
    required: ["items"],
  } as const;
}

// ---------------------------------------------------------------------------
// System prompt for Gemini
// ---------------------------------------------------------------------------

function buildSystemInstruction(context: {
  testTitle?: string;
  subject?: string;
  hasReferenceText?: boolean;
}): string {
  const lines = [
    "You are an optical character recognition and data extraction engine.",
    "Your sole purpose is to extract questions and multiple-choice options from one exam page image with strict fidelity.",
    "",
    "CRITICAL RULES:",
    "1. Zero hallucination: extract text exactly as visible.",
    "   - Do NOT add missing words.",
    "   - Do NOT generate your own filler text.",
    "   - Do NOT guess missing options.",
    "   - Do NOT answer the question.",
    "   - If a question is cut off, extract only the visible portion.",
    "2. Extract only actual MCQ question blocks.",
    "   - Do NOT treat instructions, headings, section labels, directions, page footers/headers, or normal passage text as a question.",
    "   - If a block is not a standalone MCQ, set status='rejected' and include reason(s).",
    "3. Question text must contain only the question statement.",
    "   - Do NOT append non-question notes, unrelated passage lines, answer keys, or commentary into question text.",
    "4. For each valid item, extract options in this exact structure:",
    "   options: { \"a\": \"...\", \"b\": \"...\", \"c\": \"...\", \"d\": \"...\" }",
    "   - Option values must be answer text only (remove labels like A), B., Option C).",
    "5. Mathematics and equations must be represented in standard LaTeX.",
    "   - Preserve the exact mathematical structure from the image.",
    "   - Use \\frac{numerator}{denominator} for stacked fractions.",
    "   - Wrap inline math in $...$ and display/block math in $$...$$.",
    "   - Keep ratios/proportions and equation relationships faithful to the source image while expressing them in LaTeX.",
    "6. Status classification:",
    "   - Mark status='ready' only when question text and all four options are fully visible and fully extracted from this page.",
    "   - If anything is missing/unclear, use status='partial' or 'rejected'.",
    "7. Correct option:",
    "   - Use visible answer hints only (Ans/B/Correct Option, etc.) to set correctOption.",
    "   - Use 0-based index mapping A=0, B=1, C=2, D=3.",
    "   - If not confidently visible, set correctOption=null.",
    "8. Image coordinates:",
    "   - Return questionImageBox only when a clear diagram/graph/geometric figure is required for that question.",
    "   - Bounding boxes must include a loose outer margin (about 5%-10% padding) so full edges, axes, and labels are never cropped.",
    "   - Do NOT return coordinates for logos/backgrounds/text blocks.",
    "   - If no required diagram, return an empty array [].",
    "9. Ordering:",
    "   - Number sourceIndex sequentially from 1 in exact top-to-bottom order on this page.",
    "   - Scan the ENTIRE page top-to-bottom and do not stop early after first few questions.",
    "   - If many questions exist on the page, you must still include all of them in items.",
    "10. rawBlock:",
    "   - Keep a concise excerpt of original question text including visible question number prefix.",
    "   - Max ~100 chars.",
    context.hasReferenceText ? "11. Grounding:" : null,
    context.hasReferenceText
      ? "   - Reference text from the same page is provided. Keep only questions supported by BOTH image and reference text."
      : null,
    "",
    `Context — Test: "${context.testTitle || "Unknown"}", Subject: "${context.subject || "Unknown"}"`,
  ];

  return lines.filter(Boolean).join("\n");
}

function normalizeJsonCandidate(input: string) {
  return String(input || "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function escapeControlCharsInJsonStrings(input: string) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (inString) {
      if (escaped) {
        output += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        output += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        output += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") {
        output += "\\n";
        continue;
      }
      if (ch === "\r") {
        output += "\\r";
        continue;
      }
      if (ch === "\t") {
        output += "\\t";
        continue;
      }
      output += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
    }
    output += ch;
  }

  return output;
}

function quoteUnquotedJsonKeys(input: string) {
  let output = "";
  let inString = false;
  let escaped = false;
  let expectingKey = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (inString) {
      output += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      output += ch;
      continue;
    }

    if (ch === "{" || ch === ",") {
      expectingKey = true;
      output += ch;
      continue;
    }

    if (expectingKey) {
      if (/\s/.test(ch)) {
        output += ch;
        continue;
      }

      if (ch === '"') {
        inString = true;
        expectingKey = false;
        output += ch;
        continue;
      }

      if (/[A-Za-z_]/.test(ch)) {
        let j = i + 1;
        while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j += 1;
        const key = input.slice(i, j);
        let k = j;
        while (k < input.length && /\s/.test(input[k])) k += 1;

        if (input[k] === ":") {
          output += `"${key}"`;
          i = j - 1;
          expectingKey = false;
          continue;
        }
      }

      expectingKey = false;
    }

    if (ch === "}") expectingKey = false;
    if (ch === ":") expectingKey = false;

    output += ch;
  }

  return output;
}

function parseGeminiJsonText(text: string): GeminiResponse {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("Gemini returned empty JSON text");

  const candidates = new Set<string>();
  candidates.add(raw);

  const fencedMatch = raw.match(/```json\s*([\s\S]*?)\s*```/i) || raw.match(/```\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) candidates.add(fencedMatch[1].trim());

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.add(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    const normalized = quoteUnquotedJsonKeys(
      escapeControlCharsInJsonStrings(normalizeJsonCandidate(candidate))
    );
    try {
      const parsed = JSON.parse(normalized) as GeminiResponse;
      if (parsed && Array.isArray(parsed.items)) return parsed;
    } catch {
      // keep trying other candidates
    }
  }

  // ---------- Attempt to close truncated JSON and re-parse ----------
  // Gemini sometimes hits the token limit, producing truncated JSON like:
  //   { "items": [ { ... }, { "question": "some trun
  // Strategy: find the last complete item boundary, close the array/object.
  if (firstBrace >= 0) {
    let truncated = raw.slice(firstBrace);
    // Remove any trailing incomplete string value (text after last complete quote)
    // Then brute-force close brackets/braces
    for (let trimEnd = truncated.length; trimEnd > 0; trimEnd--) {
      // Walk backwards to find the last cleanly closed object
      const slice = truncated.slice(0, trimEnd);
      // Count open/close braces and brackets outside strings
      const closers = getRequiredClosers(slice);
      if (closers === null) continue; // uncloseable (e.g. inside an unterminated string)
      const attempt = slice + closers;
      const normalized = quoteUnquotedJsonKeys(
        escapeControlCharsInJsonStrings(normalizeJsonCandidate(attempt))
      );
      try {
        const parsed = JSON.parse(normalized) as GeminiResponse;
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          console.warn(`[parseGeminiJsonText] Recovered ${parsed.items.length} items from truncated JSON (trimmed ${truncated.length - trimEnd} trailing chars)`);
          return parsed;
        }
      } catch {
        // keep trimming
      }
    }
  }

  // ---------- Object-by-object partial recovery ----------
  // Attempt partial recovery when JSON is truncated but contains complete item objects.
  const itemsKeyIdx = raw.toLowerCase().indexOf('"items"');
  if (itemsKeyIdx >= 0) {
    const arrayStart = raw.indexOf("[", itemsKeyIdx);
    if (arrayStart >= 0) {
      const recovered: GeminiMcqItem[] = [];
      let inString = false;
      let escape = false;
      let braceDepth = 0;
      let objectStart = -1;

      for (let i = arrayStart + 1; i < raw.length; i += 1) {
        const ch = raw[i];

        if (inString) {
          if (escape) {
            escape = false;
          } else if (ch === "\\") {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }

        if (ch === '"') {
          inString = true;
          continue;
        }

        if (ch === "{") {
          if (braceDepth === 0) objectStart = i;
          braceDepth += 1;
          continue;
        }

        if (ch === "}") {
          if (braceDepth > 0) {
            braceDepth -= 1;
            if (braceDepth === 0 && objectStart >= 0) {
              const objectText = normalizeJsonCandidate(raw.slice(objectStart, i + 1));
              try {
                const repaired = quoteUnquotedJsonKeys(escapeControlCharsInJsonStrings(objectText));
                recovered.push(JSON.parse(repaired) as GeminiMcqItem);
              } catch {
                // Skip malformed object and continue recovering others.
              }
              objectStart = -1;
            }
          }
          continue;
        }

        if (ch === "]" && braceDepth === 0) break;
      }

      if (recovered.length > 0) {
        console.warn(`[parseGeminiJsonText] Recovered ${recovered.length} complete item(s) via object-by-object extraction`);
        return { items: recovered };
      }
    }
  }

  throw new Error("Gemini returned invalid JSON that could not be repaired");
}

/**
 * Given a (possibly truncated) JSON string, compute the sequence of closing
 * characters needed to make it valid. Returns null if the string ends inside
 * an unterminated string literal (which we can't cleanly close).
 */
function getRequiredClosers(json: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = false; continue; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { stack.push('}'); continue; }
    if (ch === '[') { stack.push(']'); continue; }
    if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
      continue;
    }
  }

  // If we're still inside a string, we can't cleanly close — caller should trim more
  if (inString) return null;

  // Return the closers in reverse order
  return stack.reverse().join("");
}

// ---------------------------------------------------------------------------
// processWithGemini – sends a single page image to Gemini 1.5 Flash
// ---------------------------------------------------------------------------

async function processWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  context: { testTitle?: string; subject?: string; pageText?: string }
): Promise<GeminiResponse> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const modelName = getGeminiModelNameFromEnv();

    // Lazy-load GoogleGenerativeAI
    const { GoogleGenerativeAI } = await getGeminiAI();
    
    const genAI = new GoogleGenerativeAI(apiKey);

    // Build schema dynamically
    const mcqSchema = await buildMcqSchema();

    const generationConfig: GenerationConfig = {
      temperature: 0,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
      responseSchema: mcqSchema as any, // SDK typing requires cast
    };

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig,
      systemInstruction: buildSystemInstruction({
        testTitle: context.testTitle,
        subject: context.subject,
        hasReferenceText: Boolean(context.pageText && context.pageText.trim().length > 0),
      }),
    });

    // Build the multimodal content parts
    const imagePart = {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType,
      },
    };

    const requestParts: any[] = [
      "Extract all MCQs from this exam page image. " +
      "For any question that has an associated diagram, figure, or graph, " +
      "return its bounding box in questionImageBox with a 5%-10% loose margin around the full visual element (include outer edges, axes, and labels). " +
      "Return the results as structured JSON.",
    ];

    if (context.pageText && context.pageText.trim()) {
      requestParts.push(
        "Reference text extracted from the same page (use only for grounding; do not invent beyond it):\n" +
          context.pageText.slice(0, 12000)
      );
    }

    requestParts.push(imagePart);

    const result = await model.generateContent(requestParts);

    const text = result.response.text();
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    let parsed: GeminiResponse;
    try {
      parsed = parseGeminiJsonText(text);
    } catch (jsonErr) {
      const jsonErr2 = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
      console.error(`[processWithGemini] JSON parsing error: ${jsonErr2}`);
      console.error(`[processWithGemini] Attempted to parse: ${text.substring(0, 1000)}...`);
      throw new Error(`Gemini returned invalid JSON: ${jsonErr2}. Response was: ${text.substring(0, 200)}`);
    }

    // Validate the top-level shape
    if (!parsed || !Array.isArray(parsed.items)) {
      throw new Error(
        "Gemini response did not match expected schema (missing 'items' array)"
      );
    }

    return parsed;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "No stack";
    
    console.error(`[processWithGemini] Error:`, errorMsg);
    console.error(`[processWithGemini] Stack:`, errorStack);
    console.error(`[processWithGemini] Full error:`, err);
    
    // Re-throw with context
    if (errorMsg.includes("INVALID_ARGUMENT")) {
      throw new Error("Invalid PDF image sent to AI service. Please try a clearer image.");
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// extractAndCropImage – translates Gemini's 1000×1000 box → real pixels
// ---------------------------------------------------------------------------

async function extractAndCropImage(
  originalImageBuffer: Buffer,
  geminiBox: number[] // [ymin, xmin, ymax, xmax] in 0..1000
): Promise<Buffer> {
  try {
    if (!originalImageBuffer || originalImageBuffer.length === 0) {
      throw new Error("Original image buffer is empty");
    }

    const sharp = await getSharp();
    const metadata = await sharp(originalImageBuffer).metadata();
    const imgWidth = metadata.width ?? 1;
    const imgHeight = metadata.height ?? 1;

    if (imgWidth < 1 || imgHeight < 1) {
      throw new Error("Invalid image dimensions");
    }

    const [ymin, xmin, ymax, xmax] = geminiBox;

    // Map from Gemini's 1000×1000 grid to actual pixel coordinates
    // Apply padding to avoid clipping edges of diagrams
    const padX = (xmax - xmin) * BBOX_PAD_PERCENT;
    const padY = (ymax - ymin) * BBOX_PAD_PERCENT;

    const left = Math.max(0, Math.round(((xmin - padX) / 1000) * imgWidth));
    const top = Math.max(0, Math.round(((ymin - padY) / 1000) * imgHeight));
    const right = Math.min(
      imgWidth,
      Math.round(((xmax + padX) / 1000) * imgWidth)
    );
    const bottom = Math.min(
      imgHeight,
      Math.round(((ymax + padY) / 1000) * imgHeight)
    );

    const cropWidth = Math.max(1, right - left);
    const cropHeight = Math.max(1, bottom - top);

    return await sharp(originalImageBuffer)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .png()
      .toBuffer();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[extractAndCropImage] Error cropping image:`, errorMsg);
    throw new Error(`Failed to crop diagram from PDF: ${errorMsg}`);
  }
}

// ---------------------------------------------------------------------------
// uploadToImageKit – uploads a cropped image buffer to ImageKit
// ---------------------------------------------------------------------------

async function uploadToImageKit(
  croppedBuffer: Buffer,
  questionId: string,
  educatorId?: string
): Promise<string> {
  try {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new Error("ImageKit credentials not configured");
    }

    const imagekit = new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint,
    });

    const fileName = `q-${questionId}.png`;
    const folder = educatorId ? `/question-diagrams/${educatorId}` : "/question-diagrams";

    // Upload to ImageKit with buffer
    const response = await imagekit.upload({
      file: croppedBuffer,
      fileName,
      folder,
      useUniqueFileName: true,
      isPrivateFile: false,
    });

    return response.url;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown ImageKit error";
    console.error(`[uploadToImageKit] Error uploading ${questionId}:`, errorMsg);
    // Re-throw to be handled by caller
    throw new Error(`Failed to upload diagram to ImageKit: ${errorMsg}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the bounding box is valid:
 * - Exactly 4 numbers
 * - All in range [0, 1000]
 * - ymax > ymin and xmax > xmin (non-degenerate)
 */
function isValidBoundingBox(box: unknown): box is [number, number, number, number] {
  if (!Array.isArray(box) || box.length !== 4) return false;
  if (!box.every((v) => typeof v === "number" && v >= 0 && v <= 1000)) return false;

  const [ymin, xmin, ymax, xmax] = box;
  return ymax > ymin && xmax > xmin;
}

function isLikelyNecessaryDiagramBox(
  box: [number, number, number, number],
  normalized: ImportedQuestionItem
) {
  if (normalized.status === "rejected") return false;

  const [ymin, xmin, ymax, xmax] = box;
  const width = xmax - xmin;
  const height = ymax - ymin;
  const areaRatio = (width * height) / 1_000_000;

  // Tiny boxes are usually icons/noise; huge boxes are often text regions.
  if (areaRatio < 0.004) return false;
  if (areaRatio > 0.45) return false;

  // Near full-page width/height generally indicates non-diagram capture.
  if (width > 980 || height > 980) return false;

  return true;
}

function normalizeForPageVerification(input: string) {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\\((.*?)\\\)/g, " $1 ")
    .replace(/\\\[(.*?)\\\]/g, " $1 ")
    .replace(/\$\$([\s\S]*?)\$\$/g, " $1 ")
    .replace(/\$([^\n$]+?)\$/g, " $1 ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeForPageVerification(input: string) {
  return normalizeForPageVerification(input)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function hasSufficientPageTextEvidence(item: ImportedQuestionItem, pageTextRaw: string) {
  const pageText = normalizeForPageVerification(pageTextRaw);
  if (!pageText || pageText.length < 80) return true;

  const pageTokens = new Set(tokenizeForPageVerification(pageText));
  if (pageTokens.size < 12) return true;

  const candidateTokens = Array.from(
    new Set(tokenizeForPageVerification(`${item.question} ${(item.options || []).join(" ")}`))
  );

  if (candidateTokens.length < 5) return true;

  let matched = 0;
  for (const token of candidateTokens) {
    if (pageTokens.has(token)) matched += 1;
  }

  const ratio = matched / candidateTokens.length;
  const minRatio =
    candidateTokens.length >= 16 ? 0.55 : candidateTokens.length >= 10 ? 0.5 : 0.4;

  if (ratio < minRatio) return false;

  const rawBlock = normalizeForPageVerification(item.rawBlock || "");
  if (rawBlock.length >= 20) {
    const rawTokens = tokenizeForPageVerification(rawBlock);
    if (rawTokens.length >= 4) {
      let rawMatched = 0;
      for (const token of rawTokens) {
        if (pageTokens.has(token)) rawMatched += 1;
      }
      if (rawMatched / rawTokens.length < 0.5) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Retry logic for transient API failures
// ---------------------------------------------------------------------------

/**
 * Checks if an error is retryable (503, 429, or network errors)
 */
function isRetryableError(err: any): boolean {
  if (err?.status === 503) {
    return true; // Model overloaded
  }
  if (err?.status === 429) {
    return true; // Rate limited
  }
  if (err?.status === 502 || err?.status === 504) {
    return true; // Bad Gateway, Gateway Timeout
  }
  // Check for network timeouts or connection errors
  const errorMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (errorMsg.includes("econnrefused") || errorMsg.includes("timeout")) {
    return true;
  }
  if (
    errorMsg.includes("invalid json") ||
    errorMsg.includes("unterminated string") ||
    errorMsg.includes("double-quoted property name")
  ) {
    return true;
  }
  return false;
}

/**
 * Delays execution by given milliseconds
 */
function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries processWithGemini with exponential backoff for transient failures
 */
async function processWithGeminiRetry(
  imageBuffer: Buffer,
  mimeType: string,
  context: { testTitle?: string; subject?: string; pageText?: string }
): Promise<GeminiResponse> {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastError: any = null;
  let backoffMs = 1000; // Start with 1 second

  while (attempt < MAX_RETRIES) {
    try {
      if (attempt > 0) {
        await delayMs(backoffMs);
      }

      return await processWithGemini(imageBuffer, mimeType, context);
    } catch (err) {
      lastError = err;
      
      if (!isRetryableError(err)) {
        // Not a retryable error, throw immediately
        throw err;
      }

      attempt++;
      if (attempt >= MAX_RETRIES) {
        console.error(`[retry] Failed after ${MAX_RETRIES} attempts`);
        throw new Error(
          `Gemini API unavailable after ${MAX_RETRIES} retries. ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }

      // Calculate backoff for next attempt (exponential: 1s → 2s → 4s)
      backoffMs = Math.min(backoffMs * 2, 8000); // Cap at 8 seconds
      const jitter = Math.random() * 0.1 * backoffMs; // ±10% jitter
      backoffMs = Math.round(backoffMs + jitter);
    }
  }

  throw lastError || new Error("Gemini API request failed after retries");
}

// ---------------------------------------------------------------------------
// Main Vercel handler
// ---------------------------------------------------------------------------

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Initialize streaming response
    initializeStreaming(res);

    const {
      imageBase64,
      imageMimeType,
      pageText,
      fileName,
      pageNumber,
      testTitle,
      subject,
      educatorId,
    } = (req.body || {}) as ImportRequest;

    // ---- Input Validation ----
    if (!imageBase64) {
      return streamError(res, new Error("imageBase64 is required"));
    }

    if (!process.env.GEMINI_API_KEY) {
      return streamError(res, new Error("GEMINI_API_KEY is not configured"));
    }

    sendStreamEvent(res, {
      type: "progress",
      message: `Processing page ${pageNumber || "unknown"} from ${fileName || "PDF document"}...`,
    });

    // Validate MIME type
    const mimeType = imageMimeType || "image/png";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return streamError(res, new Error(`Unsupported image MIME type: ${mimeType}`));
    }

    // Decode the incoming image
    const imageBuffer = Buffer.from(imageBase64, "base64");
    if (!imageBuffer.length) {
      return streamError(res, new Error("Uploaded image is empty"));
    }

    if (imageBuffer.length > MAX_IMAGE_BYTES) {
      return streamError(res, new Error(`Image too large (${(imageBuffer.length / 1024 / 1024).toFixed(1)} MB)`));
    }

    // ---- Step 1: Gemini Extraction ----
    sendStreamEvent(res, {
      type: "progress",
      message: "Extracting MCQ questions with AI...",
    });

    let geminiResult: GeminiResponse;
    try {
      geminiResult = await processWithGeminiRetry(imageBuffer, mimeType, {
        testTitle,
        subject,
        pageText,
      });
    } catch (modelErr) {
      throw modelErr;
    }

    const rawItems = Array.isArray(geminiResult?.items)
      ? geminiResult.items
      : [];

    if (!rawItems.length) {
      sendStreamEvent(res, {
        type: "complete",
        data: {
          summary: { total: 0, ready: 0, partial: 0, rejected: 0 },
          items: [],
          meta: {
            fileName,
            pageNumber,
            diagnostics: ["No MCQ questions were detected on this page."],
          },
        },
      });
      endStreaming(res);
      return;
    }

    sendStreamEvent(res, {
      type: "progress",
      message: `Found ${rawItems.length} questions. Processing diagrams...`,
    });

    // ---- Step 2: Normalize + Crop + Upload diagrams concurrently ----
    const processedItems: (ImportedQuestionItem & {
      questionImageUrl?: string;
    })[] = await Promise.all(
      rawItems.map(async (item, idx) => {
        let normalized = normalizeImportedItem(item, idx + 1);

        if (!hasSufficientPageTextEvidence(normalized, String(pageText || ""))) {
          normalized = {
            ...normalized,
            status: "rejected",
            reasons: Array.from(
              new Set([
                ...(normalized.reasons || []),
                "Question not verified against PDF page text (removed to prevent hallucination).",
              ])
            ),
          };
        }

        // Check for a valid bounding box
        const box = item.questionImageBox;
        let questionImageUrl: string | undefined;

        if (isValidBoundingBox(box) && isLikelyNecessaryDiagramBox(box, normalized)) {
          try {
            const cropped = await extractAndCropImage(imageBuffer, box);

            const uniqueId = `p${pageNumber || 0}_q${normalized.sourceIndex}_${Date.now()}`;
            questionImageUrl = await uploadToImageKit(
              cropped,
              uniqueId,
              educatorId
            );

          } catch (cropErr) {
            console.error(
              `[import-test-questions] Failed to crop/upload image for Q${normalized.sourceIndex}:`,
              cropErr
            );
            // Non-fatal — question is still usable without the image
          }
        }

        return {
          ...normalized,
          ...(questionImageUrl ? { questionImageUrl } : {}),
        };
      })
    );

    sendStreamEvent(res, {
      type: "progress",
      message: "Finalizing results...",
    });

    // ---- Step 3: Conservative de-duplicate ----
    // Keep repeated question text if sourceIndex differs (some papers intentionally repeat stems).
    const unique = processedItems.filter((item, index, arr) => {
      if (item.status === "rejected") return true;
      const signature = `${item.sourceIndex}__${item.question.toLowerCase()}__${item.options
        .join("||")
        .toLowerCase()}`;
      return (
        arr.findIndex(
          (entry) =>
            entry.status !== "rejected" &&
            `${entry.sourceIndex}__${entry.question.toLowerCase()}__${entry.options
              .join("||")
              .toLowerCase()}` === signature
        ) === index
      );
    });

    // ---- Step 4: Build summary ----
    const summary = unique.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        return acc;
      },
      { total: 0, ready: 0, partial: 0, rejected: 0 }
    );

    sendStreamEvent(res, {
      type: "complete",
      data: {
        summary,
        items: unique,
        meta: {
          fileName,
          pageNumber,
          itemCount: unique.length,
          diagnostics: [
            `Gemini extracted ${rawItems.length} candidate(s) from page image.`,
            unique.length !== rawItems.length
              ? `${rawItems.length - unique.length} duplicate(s) removed.`
              : null,
          ].filter(Boolean),
        },
      },
    });

    endStreaming(res);
  } catch (error) {
    // Log detailed error info for debugging
    const errorDetails = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack trace";
    
    console.error("[import-test-questions] Unhandled error:");
    console.error("  Message:", errorDetails);
    console.error("  Stack:", errorStack);
    console.error("  Full error:", error);
    
    try {
      streamError(res, error);
    } catch (streamErr) {
      console.error("[import-test-questions] Failed to send error response:", streamErr);
      // Response is likely already closed, just log it
    }
  }
}
