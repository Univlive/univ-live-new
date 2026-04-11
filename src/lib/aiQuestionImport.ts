import { aiFeatureFlags, getAiFeatureDisabledMessage } from "@/lib/aiFeatureFlags";

export type AiImportStatus = "ready" | "partial" | "rejected";

export type AiImportPreviewItem = {
  sourceIndex: number;
  status: AiImportStatus;
  question: string;
  options: string[];
  correctOption: number | null;
  reasons: string[];
  marks: number;
  negativeMarks: number;
  include: boolean;
  rawBlock?: string;
  /** Public URL of a cropped diagram image, if one was detected by Gemini */
  questionImageUrl?: string;
};

export type AiImportSummary = {
  total: number;
  ready: number;
  partial: number;
  rejected: number;
};

export type AiImportResponse = {
  summary: AiImportSummary;
  items: Omit<AiImportPreviewItem, "include">[];
  meta?: {
    fileName?: string;
    pageNumber?: number;
    itemCount?: number;
    diagnostics?: string[];
  };
};

/**
 * Real-time progress update for each page being processed
 */
export type PageProgressUpdate = {
  pageNumber: number;
  totalPages: number;
  status: "detecting" | "detected" | "accepted" | "complete";
  message: string;
  pageQuestionsDetected: number;
  pageQuestionsAccepted: number;
  cumulativeDetected: number;
  cumulativeAccepted: number;
};

/**
 * Callback fired when new questions are detected and ready to add to preview
 */
export type QuestionsDetectedCallback = (
  newQuestions: AiImportPreviewItem[],
  pageNumber: number
) => void;

function sortItemsBySourceIndex<T extends { sourceIndex: number }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aIdx = Number.isFinite(Number(a.sourceIndex)) ? Number(a.sourceIndex) : Number.MAX_SAFE_INTEGER;
    const bIdx = Number.isFinite(Number(b.sourceIndex)) ? Number(b.sourceIndex) : Number.MAX_SAFE_INTEGER;
    return aIdx - bIdx;
  });
}

function hasValidCorrectOption(item: Omit<AiImportPreviewItem, "include">) {
  return (
    typeof item.correctOption === "number" &&
    item.correctOption >= 0 &&
    item.correctOption < (Array.isArray(item.options) ? item.options.length : 0)
  );
}

function extractQuestionNumber(text: string): number | null {
  const value = String(text || "");
  if (!value.trim()) return null;

  const prefixed = value.match(/(?:^|\n|\s)(?:q(?:uestion)?\s*)?(\d{1,4})\s*[:.)\]-]/i);
  if (prefixed?.[1]) return Number(prefixed[1]);

  const bracketed = value.match(/(?:^|\n|\s)[\[(](\d{1,4})[\])]/);
  if (bracketed?.[1]) return Number(bracketed[1]);

  const plain = value.match(/(?:^|\n|\s)(\d{1,4})(?:\s|$)/);
  if (plain?.[1]) return Number(plain[1]);

  return null;
}

function extractAnswerKeyPairs(text: string): Array<{ questionNumber: number; correctOption: number }> {
  const value = String(text || "");
  if (!value.trim()) return [];

  const pairs: Array<{ questionNumber: number; correctOption: number }> = [];

  // Matches common formats: "12-A", "Q12: B", "12) (C)", "12. D"
  const regex = /(?:^|[\s,;|])(?:q(?:uestion)?\s*)?(\d{1,4})\s*[-.):\]]\s*\(?([A-D])\)?(?=$|[\s,;|])/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    const questionNumber = Number(match[1]);
    const letter = String(match[2] || "").toUpperCase();
    const correctOption = letter.charCodeAt(0) - 65;
    if (
      Number.isFinite(questionNumber) &&
      questionNumber > 0 &&
      Number.isFinite(correctOption) &&
      correctOption >= 0 &&
      correctOption <= 3
    ) {
      pairs.push({ questionNumber, correctOption });
    }
  }

  return pairs;
}

function reconcileTrailingAnswerKey(items: Omit<AiImportPreviewItem, "include">[]) {
  const answerMap = new Map<number, number>();

  for (const item of items) {
    const combined = `${item.rawBlock || ""}\n${item.question || ""}`;
    const pairs = extractAnswerKeyPairs(combined);
    for (const pair of pairs) {
      // Keep the first detected mapping for a question number.
      if (!answerMap.has(pair.questionNumber)) {
        answerMap.set(pair.questionNumber, pair.correctOption);
      }
    }
  }

  if (!answerMap.size) return items;

  return items.map((item) => {
    if (hasValidCorrectOption(item)) return item;

    const combined = `${item.rawBlock || ""}\n${item.question || ""}`;
    const questionNumber = extractQuestionNumber(combined);
    if (!questionNumber) return item;

    const mappedOption = answerMap.get(questionNumber);
    if (typeof mappedOption !== "number") return item;
    if (!Array.isArray(item.options) || mappedOption < 0 || mappedOption >= item.options.length) return item;

    const nextReasons = (item.reasons || []).filter(
      (reason) => !String(reason || "").toLowerCase().includes("correct option")
    );

    const hasQuestion = Boolean(String(item.question || "").trim());
    const hasEnoughOptions = item.options.length >= 2;

    return {
      ...item,
      correctOption: mappedOption,
      status: hasQuestion && hasEnoughOptions ? "ready" : "partial",
      reasons: nextReasons,
    };
  });
}

// ---------------------------------------------------------------------------
// pdf.js – renders each page to a canvas image (not text extraction)
// ---------------------------------------------------------------------------

type PdfJsModule = {
  getDocument: (src: {
    data: Uint8Array;
    useWorkerFetch?: boolean;
    isEvalSupported?: boolean;
  }) => { promise: Promise<any> };
  GlobalWorkerOptions: { workerSrc: string };
};

const PDFJS_VERSION = "4.10.38";
const PDFJS_MODULE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjs = (await import(
    /* @vite-ignore */ PDFJS_MODULE_URL
  )) as unknown as PdfJsModule;
  if (pdfjs?.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  }
  return pdfjs;
}

/** Hard cap on rendered canvas width (px). Keeps JPEG payloads small. */
const MAX_CANVAS_WIDTH = 1500;

/** JPEG quality used for canvas export (0.7 = 70%, sharp enough for OCR) */
const JPEG_QUALITY = 0.7;

/**
 * Render a single PDF page to a compressed JPEG base64 string.
 *
 * Instead of a fixed scale, we compute the scale dynamically so the canvas
 * width never exceeds MAX_CANVAS_WIDTH (1500 px). This guarantees the
 * resulting base64 string stays well under Vercel's body-parser limit.
 */
async function renderPageToImage(
  pdfDoc: any,
  pageNumber: number
): Promise<{ base64: string; mimeType: string }> {
  const page = await pdfDoc.getPage(pageNumber);

  // Get the page's native viewport at scale=1 to measure its dimensions
  const nativeViewport = page.getViewport({ scale: 1.0 });
  const nativeWidth = nativeViewport.width;

  // Compute scale: if native width > MAX_CANVAS_WIDTH, shrink it down;
  // otherwise use scale=2 for crisp text, but still cap at MAX_CANVAS_WIDTH
  const desiredWidth = Math.min(nativeWidth * 2, MAX_CANVAS_WIDTH);
  const scale = desiredWidth / nativeWidth;

  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Export as JPEG at 70% quality — keeps payload under ~500 KB per page
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

  // Clean up canvas memory immediately
  canvas.width = 0;
  canvas.height = 0;

  return { base64, mimeType: "image/jpeg" };
}

// ---------------------------------------------------------------------------
// Main import function – renders pages → sends images → aggregates results
// ---------------------------------------------------------------------------

/**
 * Import MCQ questions from a PDF file using the multimodal Gemini endpoint.
 *
 * Each page is rendered to an image on the client, sent individually to the
 * backend, and results are aggregated with globally-unique sourceIndex values.
 *
 * An optional `onPageProgress` callback reports detailed progress for each page.
 * An optional `onQuestionsDetected` callback is fired when new questions are ready
 * to add to the preview in real-time (before all pages complete).
 */
export async function importQuestionsFromPdf(
  file: File,
  context?: {
    testTitle?: string;
    subject?: string;
    educatorId?: string;
  },
  onPageProgress?: (update: PageProgressUpdate) => void,
  abortSignal?: AbortSignal,
  onQuestionsDetected?: QuestionsDetectedCallback
): Promise<AiImportResponse> {
  if (!aiFeatureFlags.pdfImport) {
    throw new Error(getAiFeatureDisabledMessage("pdfImport"));
  }

  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: true,
    isEvalSupported: false,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages: number = pdfDoc.numPages;

  if (numPages === 0) {
    throw new Error("The uploaded PDF has no pages.");
  }

  const allItems: Omit<AiImportPreviewItem, "include">[] = [];
  let globalIndex = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;
  let cumulativeDetected = 0;
  let cumulativeAccepted = 0;
  let backoffDelay = 3000; // Start with 3 second delay between pages (increased from 1s)
  const MAX_BACKOFF = 15000; // Cap at 15 seconds (increased from 10s)
  let rateLimitCount = 0; // Track how many times we hit rate limit

  // Helper to add delay between requests
  const delayMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    // Add delay before processing (except for first page)
    if (pageNum > 1) {
      await delayMs(backoffDelay);
    }

    // Check if import was cancelled from outside
    if (abortSignal?.aborted) {
      throw new Error("PDF import cancelled by user");
    }

    // Report: Image detected for this page
    onPageProgress?.({
      pageNumber: pageNum,
      totalPages: numPages,
      status: "detecting",
      message: `Image detected for page ${pageNum}. Sending to AI...`,
      pageQuestionsDetected: 0,
      pageQuestionsAccepted: 0,
      cumulativeDetected,
      cumulativeAccepted,
    });

    // Check if import was cancelled by creating a fresh signal per page
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    let res: Response;
    let pageData: AiImportResponse | null = null;
    let pageQuestionsDetected = 0;
    let pageQuestionsAccepted = 0;

    try {
      res = await fetch("/api/ai/import-test-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          imageBase64: await renderPageToImageBase64(pdfDoc, pageNum),
          imageMimeType: "image/jpeg",
          fileName: file.name,
          pageNumber: pageNum,
          testTitle: context?.testTitle || "",
          subject: context?.subject || "",
          educatorId: context?.educatorId || "",
        }),
      });

      // Handle streaming response (Server-Sent Events)
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Response body is not readable");

        const decoder = new TextDecoder();
        let buffer = "";
        let streamDone = false;
        let hasError = false;

        while (!streamDone && !hasError) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Process all complete lines
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();

            if (line.startsWith("data: ")) {
              const jsonStr = line.substring(6).trim();

              // Check for stream terminator
              if (jsonStr === "[DONE]") {
                streamDone = true;
                break;
              }

              try {
                const event = JSON.parse(jsonStr);
                if (event.type === "complete" && event.data) {
                  pageData = event.data as AiImportResponse;
                  pageQuestionsDetected = pageData.items?.length ?? 0;
                  consecutiveErrors = 0; // Reset error counter on success
                  
                  // Report: Questions detected
                  if (pageQuestionsDetected > 0) {
                    cumulativeDetected += pageQuestionsDetected;
                    onPageProgress?.({
                      pageNumber: pageNum,
                      totalPages: numPages,
                      status: "detected",
                      message: `Detected ${pageQuestionsDetected} question${pageQuestionsDetected !== 1 ? "s" : ""}`,
                      pageQuestionsDetected,
                      pageQuestionsAccepted: 0,
                      cumulativeDetected,
                      cumulativeAccepted,
                    });
                  }
                } else if (event.type === "error") {
                  hasError = true;
                  consecutiveErrors++;
                  throw new Error(event.error || "Unknown error from API");
                }
              } catch (parseErr) {
                console.error("Failed to parse stream event:", parseErr);
              }
            }
          }

          // Keep the last incomplete line in buffer
          buffer = lines[lines.length - 1];
        }

        if (hasError) {
          throw new Error("Failed to process page");
        }

        if (!pageData || !res.ok) {
          consecutiveErrors++;
          throw new Error(`API error: ${res.status}`);
        }
      } else {
        // Fallback for non-streaming response (e.g., JSON)
        pageData = (await res.json().catch(() => ({}))) as AiImportResponse;

        if (!res.ok) {
          consecutiveErrors++;
          throw new Error(`API error: ${res.status}`);
        }

        pageQuestionsDetected = pageData.items?.length ?? 0;
        if (pageQuestionsDetected > 0) {
          cumulativeDetected += pageQuestionsDetected;
          onPageProgress?.({
            pageNumber: pageNum,
            totalPages: numPages,
            status: "detected",
            message: `Detected ${pageQuestionsDetected} question${pageQuestionsDetected !== 1 ? "s" : ""}`,
            pageQuestionsDetected,
            pageQuestionsAccepted: 0,
            cumulativeDetected,
            cumulativeAccepted,
          });
        }
      }

      // If we got here, processing was successful
      if (pageData?.items) {
        const pageNewItems: AiImportPreviewItem[] = [];
        const pageItems = sortItemsBySourceIndex(pageData.items || []);
        
        for (const item of pageItems) {
          globalIndex += 1;
          allItems.push({
            ...item,
            sourceIndex: globalIndex,
          });
          // Count accepted items (ready or partial)
          if (item.status !== "rejected") {
            pageQuestionsAccepted++;
          }
          // Track new items for callback
          pageNewItems.push({
            ...item,
            sourceIndex: globalIndex,
            include: item.status === "ready",
          });
        }
        cumulativeAccepted += pageQuestionsAccepted;

        // Fire callback to add questions to preview in real-time
        if (pageNewItems.length > 0) {
          onQuestionsDetected?.(pageNewItems, pageNum);
        }

        // Report: Page complete with accepted count
        onPageProgress?.({
          pageNumber: pageNum,
          totalPages: numPages,
          status: "accepted",
          message: `Accepted ${pageQuestionsAccepted} of ${pageQuestionsDetected} question${pageQuestionsDetected !== 1 ? "s" : ""}`,
          pageQuestionsDetected,
          pageQuestionsAccepted,
          cumulativeDetected,
          cumulativeAccepted,
        });
      }
    } catch (pageErr: any) {
      // Check if this was a cancellation error
      if (pageErr?.name === "AbortError") {
        throw new Error("PDF import cancelled by user");
      }

      // Check if it's a rate limit error (429 or "Too many requests")
      const errorMsg = pageErr instanceof Error ? pageErr.message : String(pageErr);
      const isRateLimit = 
        errorMsg.includes("Too many requests") || 
        errorMsg.includes("429") ||
        errorMsg.includes("rate limit");

      if (isRateLimit) {
        // Increase backoff delay aggressively on rate limit
        console.warn(`[importQuestionsFromPdf] Rate limit hit on page ${pageNum}. Increasing backoff delay from ${backoffDelay}ms.`);
        rateLimitCount++;
        
        // More aggressive backoff: triple the delay each time we hit rate limit
        backoffDelay = Math.min(backoffDelay * 3, MAX_BACKOFF);
        console.warn(`[importQuestionsFromPdf] New backoff delay: ${backoffDelay}ms (rate limit count: ${rateLimitCount})`);
        
        consecutiveErrors = 0; // Don't count rate limits as regular errors
        
        // Report the rate limit issue but continue
        onPageProgress?.({
          pageNumber: pageNum,
          totalPages: numPages,
          status: "complete",
          message: `Page ${pageNum} paused (rate limited). Waiting ${Math.round(backoffDelay/1000)}s before retry...`,
          pageQuestionsDetected: 0,
          pageQuestionsAccepted: 0,
          cumulativeDetected,
          cumulativeAccepted,
        });
      } else if (pageErr instanceof Error && pageErr.message.includes("API error")) {
        console.error(`Failed to process page ${pageNum}:`, pageErr);
        consecutiveErrors++;
        // Increase backoff slightly on other API errors too
        backoffDelay = Math.min(backoffDelay * 1.5, MAX_BACKOFF);

        // Stop if we have too many consecutive errors
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          throw new Error(
            `The AI service is experiencing issues. Failed to process page ${pageNum}. ` +
            `Please try again later or contact support.`
          );
        }
      } else {
        // For other errors, just log and continue
        console.error(`Failed to process page ${pageNum}:`, pageErr);
        consecutiveErrors++;
        // Increase backoff slightly
        backoffDelay = Math.min(backoffDelay * 1.3, MAX_BACKOFF);

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          throw new Error(
            `Unable to process the PDF. Multiple pages failed. ` +
            `Please try uploading a clearer PDF or contact support.`
          );
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Report final status for this page
    onPageProgress?.({
      pageNumber: pageNum,
      totalPages: numPages,
      status: "complete",
      message: `Page ${pageNum} complete. Total: ${cumulativeDetected} detected, ${cumulativeAccepted} accepted`,
      pageQuestionsDetected,
      pageQuestionsAccepted,
      cumulativeDetected,
      cumulativeAccepted,
    });
  }

  const reconciledItems = sortItemsBySourceIndex(reconcileTrailingAnswerKey(allItems));

  // Build aggregate summary
  const summary = reconciledItems.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] += 1;
      return acc;
    },
    { total: 0, ready: 0, partial: 0, rejected: 0 }
  );

  if (allItems.length === 0 && numPages > 0) {
    throw new Error(
      "No MCQ questions could be detected in this PDF. " +
      "Please ensure you're uploading a clear PDF with visible MCQ questions."
    );
  }

  return {
    summary,
    items: reconciledItems,
    meta: {
      fileName: file.name,
      diagnostics: [],
    },
  };
}

/**
 * Helper to render a page and return base64 immediately
 */
async function renderPageToImageBase64(
  pdfDoc: any,
  pageNumber: number
): Promise<string> {
  const { base64 } = await renderPageToImage(pdfDoc, pageNumber);
  return base64;
}

// ---------------------------------------------------------------------------
// Utility exports (unchanged, kept for backward compat)
// ---------------------------------------------------------------------------

export function formatNegativeMarksDisplay(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (n < 0) return String(n);
  return `-${n}`;
}

function cleanText(input: string) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

/**
 * Strips leading option labels from option text
 * Examples:
 *   "A. Water" → "Water"
 *   "B) Oxygen" → "Oxygen"
 *   "(C) Carbon" → "Carbon"
 *   "[D] Nitrogen" → "Nitrogen"
 *   "Option A: Water" → "Water"
 *   "C: Carbon" → "Carbon"
 *   "D - Nitrogen" → "Nitrogen"
 */
function stripOptionLabel(optionText: string): string {
  let cleaned = cleanText(optionText);
  if (!cleaned) return cleaned;

  const labelPatterns = [
    /^\s*(?:option|choice)\s*[A-D]\s*[\)\].:\-]?\s*/i,
    /^\s*[\[(]\s*[A-D]\s*[\])]\s*[\)\].:\-]?\s*/i,
    /^\s*[A-D]\s*[\)\].:\-]\s*/i,
    // Handles forms like: "A $\\frac{1}{5}..." or "B \\sqrt{2}".
    /^\s*[A-D]\s+(?=(?:\$|\\|\d))/i,
    /^\s*(?:option|choice)\s*[1-4]\s*[\)\].:\-]?\s*/i,
    /^\s*[\[(]\s*[1-4]\s*[\])]\s*[\)\].:\-]?\s*/i,
    /^\s*[1-4]\s*[\)\].:\-]\s*/i,
  ];

  // Some extracts can include stacked labels, e.g. "Option A) A. Text"
  for (let i = 0; i < 3; i += 1) {
    let changed = false;
    for (const pattern of labelPatterns) {
      const next = cleaned.replace(pattern, "");
      if (next !== cleaned) {
        cleaned = cleanText(next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return cleaned;
}

function buildPlaceholderOption(index: number) {
  return `[Review Required] Option ${String.fromCharCode(65 + index)}`;
}

export function buildImportedQuestionPayload(item: AiImportPreviewItem) {
  const cleanQuestion = cleanText(item.question);
  const options = Array.isArray(item.options)
    ? item.options
        .map((option) => stripOptionLabel(option)) // Strip A, B, C, D prefixes
        .filter(Boolean)
        .slice(0, 4)
    : [];

  const hasQuestion = Boolean(cleanQuestion);
  const hasEnoughOptions = options.length >= 2;
  const hasValidCorrectOption =
    typeof item.correctOption === "number" &&
    item.correctOption >= 0 &&
    item.correctOption < options.length;

  const ready =
    item.status === "ready" &&
    hasQuestion &&
    hasEnoughOptions &&
    hasValidCorrectOption;

  const payloadOptions = ready
    ? options
    : (() => {
        const next = [...options];
        while (next.length < 4)
          next.push(buildPlaceholderOption(next.length));
        return next.slice(0, 4);
      })();

  // If the question has a cropped diagram URL, embed it in the question HTML
  let questionHtml = hasQuestion
    ? cleanQuestion
    : "[Review Required] Question text could not be extracted from the PDF.";

  if (item.questionImageUrl) {
    questionHtml += `\n<img src="${item.questionImageUrl}" alt="Question diagram" />`;
  }

  return {
    question: questionHtml,
    options: payloadOptions,
    correctOption: hasValidCorrectOption ? Number(item.correctOption) : 0,
    explanation: "",
    difficulty: "medium" as const,
    subject: "",
    topic: "",
    marks: 5,
    negativeMarks: -1,
    isActive: ready,
    source: ready ? "ai_import" : "ai_import_partial",
    importStatus: ready ? "ready" : "partial",
    reviewRequired: !ready,
    importIssues: Array.isArray(item.reasons)
      ? item.reasons.filter(Boolean)
      : [],
    importSourceIndex: item.sourceIndex,
    rawImportBlock: item.rawBlock || "",
    ...(item.questionImageUrl
      ? { questionImageUrl: item.questionImageUrl }
      : {}),
  };
}
