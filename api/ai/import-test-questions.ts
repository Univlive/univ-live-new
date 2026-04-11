import { VercelRequest, VercelResponse } from "@vercel/node";

// ---------------------------------------------------------------------------
// Vercel Serverless Config – raise body parser limit from default 1 MB to 10 MB
// so that large Base64-encoded page images are accepted without a 413 error.
// ---------------------------------------------------------------------------
export const config = {
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
  options: string[];
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
const BBOX_PAD_PERCENT = 0.05;

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
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
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
}): string {
  return [
    "You are an expert MCQ extraction engine for educational test papers.",
    "You will receive an image of a single page from a PDF exam paper.",
    "",
    "Your task:",
    "1. Identify every single-correct Multiple Choice Question (MCQ) visible on the page.",
    "2. For each question, extract: the full question text (preserving math notation where possible),",
    "   the options (A/B/C/D), and the correct option index (0-based: A=0, B=1, C=2, D=3).",
    "3. If a question contains an associated diagram, figure, graph, chart, or embedded image,",
    "   return a bounding box in `questionImageBox` as [ymin, xmin, ymax, xmax] using Gemini's",
    "   standard 1000×1000 coordinate grid (0 = top-left, 1000 = bottom-right).",
    "   The bounding box MUST tightly enclose the diagram/figure itself.",
    "   If no diagram exists for a question, return an empty array [].",
    "4. Use answer hints visible on the page (like 'Ans: B', 'Correct option: 2', answer keys)",
    "   to set correctOption. Map letter answers to 0-based indices: A=0, B=1, C=2, D=3.",
    "5. If you cannot confidently determine the correct answer, set status to 'partial'",
    "   and correctOption to null.",
    "6. If a block is not a valid MCQ (e.g. instructions, headers, page numbers),",
    "   set status to 'rejected'.",
    "7. Do NOT invent or hallucinate any content. Only extract what is visually present.",
    "8. Number each question sequentially starting from sourceIndex 1.",
    "9. Keep rawBlock as a concise plain-text excerpt of the original question (max ~80 chars).",
    "10. Preserve mathematical expressions as closely as possible (use Unicode symbols",
    "    or LaTeX-like notation if clear from the page).",
    "",
    `Context — Test: "${context.testTitle || "Unknown"}", Subject: "${context.subject || "Unknown"}"`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// processWithGemini – sends a single page image to Gemini 1.5 Flash
// ---------------------------------------------------------------------------

async function processWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  context: { testTitle?: string; subject?: string }
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
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: mcqSchema as any, // SDK typing requires cast
    };

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig,
      systemInstruction: buildSystemInstruction(context),
    });

    // Build the multimodal content parts
    const imagePart = {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType,
      },
    };

    const result = await model.generateContent([
      "Extract all MCQs from this exam page image. " +
      "For any question that has an associated diagram, figure, or graph, " +
      "return its bounding box in questionImageBox. " +
      "Return the results as structured JSON.",
      imagePart,
    ]);

    const text = result.response.text();
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    let parsed: GeminiResponse;
    try {
      parsed = JSON.parse(text) as GeminiResponse;
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
  context: { testTitle?: string; subject?: string }
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

    const geminiResult = await processWithGeminiRetry(imageBuffer, mimeType, {
      testTitle,
      subject,
    });

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
        const normalized = normalizeImportedItem(item, idx + 1);

        // Check for a valid bounding box
        const box = item.questionImageBox;
        let questionImageUrl: string | undefined;

        if (isValidBoundingBox(box)) {
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

    // ---- Step 3: De-duplicate ----
    const unique = processedItems.filter((item, index, arr) => {
      if (item.status === "rejected") return true;
      const signature = `${item.question.toLowerCase()}__${item.options
        .join("||")
        .toLowerCase()}`;
      return (
        arr.findIndex(
          (entry) =>
            entry.status !== "rejected" &&
            `${entry.question.toLowerCase()}__${entry.options
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
