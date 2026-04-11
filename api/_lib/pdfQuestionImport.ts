import { inflateRawSync, inflateSync } from "zlib";

export type ImportedQuestionStatus = "ready" | "partial" | "rejected";

export type ImportedQuestionItem = {
  sourceIndex: number;
  status: ImportedQuestionStatus;
  question: string;
  options: string[];
  correctOption: number | null;
  reasons: string[];
  marks: number;
  negativeMarks: number;
  rawBlock?: string;
};

function decodePdfEscapes(input: string) {
  return input
    .replace(/\\([nrtbf])/g, (_, ch) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[ch] || ch))
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\([0-7]{1,3})/g, (_, oct) => {
      try {
        return String.fromCharCode(parseInt(oct, 8));
      } catch {
        return "";
      }
    });
}

function decodeHexString(input: string) {
  const clean = input.replace(/\s+/g, "");
  const padded = clean.length % 2 === 0 ? clean : `${clean}0`;
  const chars: string[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    const code = Number.parseInt(padded.slice(i, i + 2), 16);
    if (Number.isFinite(code)) chars.push(String.fromCharCode(code));
  }
  return chars.join("");
}

function cleanExtractedText(input: string) {
  return input
    .replace(/\u0000/g, " ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ ?([,:;!?])/g, "$1")
    .trim();
}

function extractTextFromContent(content: string) {
  const pieces: string[] = [];
  const textBlocks = content.match(/BT[\s\S]*?ET/g) || [];

  for (const block of textBlocks) {
    const literalMatches = block.match(/\((?:\\.|[^\\()])*\)/g) || [];
    for (const literal of literalMatches) {
      const decoded = decodePdfEscapes(literal.slice(1, -1));
      if (decoded.trim()) pieces.push(decoded);
    }

    const hexMatches = block.match(/<([0-9A-Fa-f\s]{2,})>/g) || [];
    for (const raw of hexMatches) {
      const decoded = decodeHexString(raw.slice(1, -1));
      if (decoded.trim()) pieces.push(decoded);
    }
  }

  return pieces;
}

function tryInflate(buffer: Buffer) {
  try {
    return inflateSync(buffer).toString("latin1");
  } catch {
    try {
      return inflateRawSync(buffer).toString("latin1");
    } catch {
      return null;
    }
  }
}

export function extractPdfText(buffer: Buffer) {
  const latin1 = buffer.toString("latin1");
  const pieces: string[] = [];
  const diagnostics: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(latin1)) !== null) {
    const streamBody = match[1] || "";
    const streamBuffer = Buffer.from(streamBody, "latin1");
    const headerWindow = latin1.slice(Math.max(0, match.index - 220), match.index);
    const maybeFlate = /FlateDecode/.test(headerWindow);

    const candidates = [streamBody];
    if (maybeFlate) {
      const inflated = tryInflate(streamBuffer);
      if (inflated) candidates.unshift(inflated);
    }

    for (const candidate of candidates) {
      const textPieces = extractTextFromContent(candidate);
      if (textPieces.length) pieces.push(textPieces.join("\n"));
    }
  }

  if (!pieces.length) {
    diagnostics.push("No BT/ET text blocks were extracted from PDF streams.");
  }

  const fallbackLiteralMatches = latin1.match(/\((?:\\.|[^\\()])*\)/g) || [];
  if (fallbackLiteralMatches.length) {
    const fallbackText = fallbackLiteralMatches
      .slice(0, 1200)
      .map((item) => decodePdfEscapes(item.slice(1, -1)))
      .filter((item) => item.trim())
      .join("\n");
    if (fallbackText.trim()) pieces.push(fallbackText);
  }

  const text = cleanExtractedText(pieces.join("\n\n"));
  if (!text) diagnostics.push("PDF text extraction produced empty text.");

  return { text, diagnostics };
}

function looksLikeQuestionStart(line: string) {
  const value = line.trim();
  if (!value) return false;
  if (/^(ans|answer|solution|explanation)\b/i.test(value)) return false;
  return (
    /^(q(?:uestion)?\s*\d{1,3}|\(?\d{1,3}[)\].:-])\s+/i.test(value) ||
    (/^\d{1,3}\s+/.test(value) && /[?]|[A-Za-z]/.test(value))
  );
}

function looksLikeMcqSegment(segment: string) {
  const normalized = segment.replace(/\r/g, "");
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0] || "";
  const optionCount = (normalized.match(/(?:^|\n)\s*(?:[A-Da-d][\).:-]|\([A-Da-d]\)|[1-4][\).:-])\s+/gm) || []).length;
  const hasAnswerHint = /(ans(?:wer)?|correct(?: answer| option| choice)?|right option|final answer|the correct choice)/i.test(normalized);
  const hasQuestionMarker = looksLikeQuestionStart(firstLine) || /\?/.test(firstLine);
  return optionCount >= 2 && (hasQuestionMarker || hasAnswerHint);
}

export function segmentQuestionCandidates(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const segments: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (looksLikeQuestionStart(line) && current.length) {
      segments.push(current.join("\n"));
      current = [line];
      continue;
    }
    current.push(line);
  }

  if (current.length) segments.push(current.join("\n"));

  const cleaned = segments
    .map((segment) => segment.replace(/\n{3,}/g, "\n\n").trim())
    .filter((segment) => segment.length >= 15)
    .filter((segment) => looksLikeMcqSegment(segment));

  if (cleaned.length >= 1) return cleaned.slice(0, 150);

  const fallback = text
    .split(/\n\n+/)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter((segment) => segment.length >= 20)
    .filter((segment) => looksLikeMcqSegment(segment));

  return fallback.slice(0, 150);
}

export function parseJsonResponse<T>(content: string): T {
  const jsonMatch =
    content.match(/```json\s*([\s\S]*?)\s*```/i) ||
    content.match(/```\s*([\s\S]*?)\s*```/i) ||
    [null, content];
  const jsonString = (jsonMatch[1] || content || "").trim();
  return JSON.parse(jsonString) as T;
}

function stripQuestionNumberPrefix(input: string) {
  const value = input.trim();
  if (!value) return value;

  const patterns = [
    /^(?:q(?:uestion)?\s*(?:no\.?\s*)?)\d{1,4}\s*[:.)-]\s*/i,
    /^(?:q(?:uestion)?\s*(?:no\.?\s*)?)\d{1,4}\s+/i,
    /^\(\s*\d{1,4}\s*\)\s*/,
    /^\[\s*\d{1,4}\s*\]\s*/,
    /^\d{1,4}\s*[:.)-]\s*/,
  ];

  for (const pattern of patterns) {
    if (pattern.test(value)) {
      return value.replace(pattern, "").trim();
    }
  }

  return value;
}

export function normalizeImportedItem(item: any, fallbackIndex: number): ImportedQuestionItem {
  const question = stripQuestionNumberPrefix(String(item?.question || ""));
  const options = Array.isArray(item?.options)
    ? item.options.map((option: any) => String(option || "").trim()).filter(Boolean).slice(0, 4)
    : [];

  const rawCorrectOption = item?.correctOption;
  const correctOption =
    typeof rawCorrectOption === "number" && Number.isFinite(rawCorrectOption)
      ? rawCorrectOption
      : rawCorrectOption == null || rawCorrectOption === ""
        ? null
        : Number.isFinite(Number(rawCorrectOption))
          ? Number(rawCorrectOption)
          : null;

  const reasons = Array.isArray(item?.reasons)
    ? item.reasons.map((reason: any) => String(reason || "").trim()).filter(Boolean)
    : [];

  let status: ImportedQuestionStatus = item?.status === "ready" || item?.status === "partial" || item?.status === "rejected"
    ? item.status
    : "partial";

  if (!question) reasons.push("Question text could not be extracted.");
  if (options.length < 2) reasons.push("At least two options could not be identified.");
  if (correctOption == null || correctOption < 0 || correctOption >= options.length) {
    reasons.push("Correct option could not be identified confidently.");
  }

  if (!question && !options.length) status = "rejected";
  else if (!question || options.length < 2 || correctOption == null || correctOption < 0 || correctOption >= options.length) {
    status = status === "rejected" ? "rejected" : "partial";
  } else {
    status = "ready";
  }

  return {
    sourceIndex: Number.isFinite(Number(item?.sourceIndex)) ? Number(item.sourceIndex) : fallbackIndex,
    status,
    question,
    options,
    correctOption: status === "ready" ? Number(correctOption) : correctOption,
    reasons: Array.from(new Set(reasons)),
    marks: 5,
    negativeMarks: -1,
    rawBlock: typeof item?.rawBlock === "string" ? item.rawBlock : "",
  };
}
