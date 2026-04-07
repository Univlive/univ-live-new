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
 * An optional `onPageProgress` callback reports progress to the UI.
 */
export async function importQuestionsFromPdf(
  file: File,
  context?: {
    testTitle?: string;
    subject?: string;
    educatorId?: string;
  },
  onPageProgress?: (completed: number, total: number) => void
): Promise<AiImportResponse> {
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
  const allDiagnostics: string[] = [];
  let globalIndex = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const { base64, mimeType } = await renderPageToImage(pdfDoc, pageNum);

      const res = await fetch("/api/ai/import-test-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          imageMimeType: mimeType,
          fileName: file.name,
          pageNumber: pageNum,
          testTitle: context?.testTitle || "",
          subject: context?.subject || "",
          educatorId: context?.educatorId || "",
        }),
      });

      const pageData = await res.json().catch(() => ({}));

      if (!res.ok) {
        allDiagnostics.push(
          `Page ${pageNum}: ${pageData?.error || "API error"}`
        );
        continue;
      }

      const pageResult = pageData as AiImportResponse;

      // Re-number sourceIndex to be globally unique across all pages
      for (const item of pageResult.items || []) {
        globalIndex += 1;
        allItems.push({
          ...item,
          sourceIndex: globalIndex,
        });
      }

      if (pageResult.meta?.diagnostics) {
        allDiagnostics.push(
          ...pageResult.meta.diagnostics.map((d) => `Page ${pageNum}: ${d}`)
        );
      }
    } catch (pageErr) {
      console.error(`Failed to process page ${pageNum}:`, pageErr);
      allDiagnostics.push(
        `Page ${pageNum}: ${pageErr instanceof Error ? pageErr.message : "Unknown error"}`
      );
    }

    // Report progress
    onPageProgress?.(pageNum, numPages);
  }

  // Build aggregate summary
  const summary = allItems.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] += 1;
      return acc;
    },
    { total: 0, ready: 0, partial: 0, rejected: 0 }
  );

  if (allItems.length === 0 && numPages > 0) {
    throw new Error(
      "No MCQ questions could be detected in any page of this PDF. " +
        (allDiagnostics.length
          ? `Diagnostics: ${allDiagnostics.join("; ")}`
          : "")
    );
  }

  return {
    summary,
    items: allItems,
    meta: {
      fileName: file.name,
      diagnostics: allDiagnostics,
    },
  };
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

function buildPlaceholderOption(index: number) {
  return `[Review Required] Option ${String.fromCharCode(65 + index)}`;
}

export function buildImportedQuestionPayload(item: AiImportPreviewItem) {
  const cleanQuestion = cleanText(item.question);
  const options = Array.isArray(item.options)
    ? item.options
        .map((option) => cleanText(option))
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
