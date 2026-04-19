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
  const escapeMap: Record<"n" | "r" | "t" | "b" | "f", string> = {
    n: "\n",
    r: "\r",
    t: "\t",
    b: "\b",
    f: "\f",
  };

  return input
    .replace(/\\([nrtbf])/g, (_, ch: string) => escapeMap[ch as keyof typeof escapeMap] || ch)
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

const SPECIAL_MATH_SYMBOL_TO_LATEX: Record<string, string> = {
  // Common private-use glyphs from Symbol-like encodings found in PDFs.
  "\uF061": "\\alpha",
  "\uF062": "\\beta",
  "\uF063": "\\chi",
  "\uF064": "\\delta",
  "\uF065": "\\epsilon",
  "\uF066": "\\phi",
  "\uF067": "\\gamma",
  "\uF068": "\\eta",
  "\uF069": "\\iota",
  "\uF06B": "\\kappa",
  "\uF06C": "\\lambda",
  "\uF06D": "\\mu",
  "\uF06E": "\\nu",
  "\uF070": "\\pi",
  "\uF071": "\\theta",
  "\uF072": "\\rho",
  "\uF073": "\\sigma",
  "\uF074": "\\tau",
  "\uF075": "\\upsilon",
  "\uF076": "\\varsigma",
  "\uF077": "\\omega",
  "\uF078": "\\xi",
  "\uF079": "\\psi",
  "\uF07A": "\\zeta",
  "\uF0B1": "\\pm",
  "\uF0B9": "\\neq",
  "\uF0A5": "\\infty",

  // Unicode Greek/math symbols.
  "\u03B1": "\\alpha",
  "\u03B2": "\\beta",
  "\u03B3": "\\gamma",
  "\u03B4": "\\delta",
  "\u03B5": "\\epsilon",
  "\u03B8": "\\theta",
  "\u03BB": "\\lambda",
  "\u03BC": "\\mu",
  "\u03C0": "\\pi",
  "\u03C1": "\\rho",
  "\u03C3": "\\sigma",
  "\u03C4": "\\tau",
  "\u03C6": "\\phi",
  "\u03A9": "\\Omega",
  "\u03C9": "\\omega",
  "\u00D7": "\\times",
  "\u00F7": "\\div",
  "\u2264": "\\leq",
  "\u2265": "\\geq",
  "\u2260": "\\neq",
  "\u00B1": "\\pm",
  "\u221E": "\\infty",
  "\u2211": "\\sum",
  "\u222B": "\\int",
  "\u2202": "\\partial",
  "\u2206": "\\Delta",
  "\u2212": "-",
};

function normalizeSpecialMathSymbolsToLatex(input: string) {
  const value = String(input || "");
  if (!value) return "";

  const replaced = value.replace(
    /[\u03B1\u03B2\u03B3\u03B4\u03B5\u03B8\u03BB\u03BC\u03C0\u03C1\u03C3\u03C4\u03C6\u03A9\u03C9\u00D7\u00F7\u2264\u2265\u2260\u00B1\u221E\u2211\u222B\u2202\u2206\u2212\uF000-\uF0FF]/g,
    (symbol) => SPECIAL_MATH_SYMBOL_TO_LATEX[symbol] || symbol
  );

  // Ensure known symbol commands are separated from immediate trailing variables, e.g. "\pir" -> "\pi r".
  return replaced.replace(
    /(\\(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|omega|xi|psi|zeta|eta|kappa|upsilon|varsigma|Delta|Omega))(?=[A-Za-z0-9])/g,
    "$1 "
  );
}

function cleanExtractedText(input: string) {
  return normalizeSpecialMathSymbolsToLatex(input)
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
    /^(?:q(?:uestion)?\s*(?:no\.?\s*)?)\d{1,4}\s*[.)-]\s*/i,
    /^(?:q(?:uestion)?\s*(?:no\.?\s*)?)\d{1,4}\s*:\s*(?!\d)/i,
    /^(?:q(?:uestion)?\s*(?:no\.?\s*)?)\d{1,4}\s+/i,
    /^\(\s*\d{1,4}\s*\)\s*/,
    /^\[\s*\d{1,4}\s*\]\s*/,
    /^\d{1,4}\s*[.)-]\s*/,
    /^\d{1,4}\s*:\s*(?!\d)/,
  ];

  for (const pattern of patterns) {
    if (pattern.test(value)) {
      return value.replace(pattern, "").trim();
    }
  }

  return value;
}

function normalizeQuestionText(input: string) {
  const lines = String(input || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!lines.length) return "";

  const optionLinePattern = /^\s*(?:(?:option|choice)\s*)?(?:[A-D]\s*[)\].:\-]|[1-4]\s*[)\].-])\s+/i;
  const answerHintLinePattern = /^\s*(?:ans(?:wer)?|correct(?:\s+answer|\s+option|\s+choice)?|solution)\b/i;

  const looksMathHeavyLine = (line: string) => {
    const value = String(line || "").trim();
    if (!value) return false;

    if (/\\(?:frac|dfrac|tfrac|sqrt|sum|int|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|omega|xi|psi|zeta|eta|kappa|upsilon|varsigma|Delta|Omega|pm|times|div|leq|geq|neq|infty|partial)\b/.test(value)) {
      return true;
    }

    if (/\$/.test(value)) return true;
    if (/[\u00B1\u00D7\u00F7\u221A\u2211\u222B\u2260\u2264\u2265\u03C0]/.test(value)) return true;
    if (/\b\d+\s*:\s*\d+\b/.test(value)) return true;
    if (/\b[A-Za-z0-9]+\s*[=^]\s*[A-Za-z0-9]+\b/.test(value)) return true;
    if (/\b[A-Za-z0-9]+\s*[+\-*/]\s*[A-Za-z0-9]+\b/.test(value)) return true;

    return false;
  };

  const cleanedLines = lines.filter((line) => {
    if (answerHintLinePattern.test(line)) return false;
    if (!optionLinePattern.test(line)) return true;
    // Keep lines that look mathematically meaningful even if they resemble an option label.
    return looksMathHeavyLine(line);
  });

  return cleanedLines.join("\n").trim();
}

function normalizeMathNotationToLatex(input: string) {
  const value = normalizeSpecialMathSymbolsToLatex(String(input || ""));
  if (!value.trim()) return "";

  // Convert legacy LaTeX delimiters to dollar delimiters for consistency.
  const normalizedDelimiters = value
    .replace(/\\\(([^]+?)\\\)/g, (_, expr: string) => `$${String(expr || "").trim()}$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, expr: string) => `$$${String(expr || "").trim()}$$`);

  const fractionMap: Record<string, string> = {
    "½": "\\frac{1}{2}",
    "⅓": "\\frac{1}{3}",
    "⅔": "\\frac{2}{3}",
    "¼": "\\frac{1}{4}",
    "¾": "\\frac{3}{4}",
    "⅕": "\\frac{1}{5}",
    "⅖": "\\frac{2}{5}",
    "⅗": "\\frac{3}{5}",
    "⅘": "\\frac{4}{5}",
    "⅙": "\\frac{1}{6}",
    "⅚": "\\frac{5}{6}",
    "⅛": "\\frac{1}{8}",
    "⅜": "\\frac{3}{8}",
    "⅝": "\\frac{5}{8}",
    "⅞": "\\frac{7}{8}",
  };

  const parts = normalizedDelimiters.split(/(\${1,2}[\s\S]*?\${1,2})/g);

  const processed = parts
    .map((part) => {
      if (!part) return part;
      if (/^\${1,2}[\s\S]*\${1,2}$/.test(part)) return part;

      let out = part;

      out = out.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (ch) => fractionMap[ch] || ch);

      // Convert simple slash fractions to LaTeX fractions.
      out = out.replace(
        /(^|[^\\\w])([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9]+)(?=$|[^\w])/g,
        (_match: string, prefix: string, num: string, den: string) => `${prefix}\\frac{${num}}{${den}}`
      );

      // Ensure LaTeX fractions are wrapped in inline math mode.
      out = out.replace(
        /\\(?:frac|dfrac|tfrac)\s*\{[^{}]+\}\s*\{[^{}]+\}/g,
        (expr: string) => `$${expr}$`
      );

      // Ensure standalone symbol commands are wrapped in inline math mode.
      out = out.replace(
        /\\(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|omega|xi|psi|zeta|eta|kappa|upsilon|varsigma|Delta|Omega|pm|times|div|leq|geq|neq|infty|sum|int|partial)(?:\s*_[^\s^{}]+|\s*_\{[^}]+\})?(?:\s*\^[^\s_{}]+|\s*\^\{[^}]+\})?/g,
        (expr: string) => `$${expr.trim()}$`
      );

      // Wrap simple equation chains in inline math mode.
      out = out.replace(
        /\b(?:[A-Za-z]|\d+)(?:\s*[=+\-*/^]\s*(?:[A-Za-z]|\d+)){1,}\b/g,
        (expr: string) => `$${expr.trim()}$`
      );

      // Wrap simple ratio/proportion patterns in inline math mode.
      out = out.replace(
        /\b([A-Za-z0-9]+\s*:\s*[A-Za-z0-9]+)\b/g,
        (_match: string, expr: string) => `$${expr.replace(/\s+/g, "")}$`
      );

      return out;
    })
    .join("");

  return processed;
}

function looksLikeInstructionOrMetaText(question: string) {
  const q = question.trim().toLowerCase();
  if (!q) return true;

  return [
    /^directions?\b/,
    /^instruction\b/,
    /^read\s+the\s+following\b/,
    /^section\s+[a-z0-9]+\b/,
    /^passage\b/,
    /^comprehension\b/,
    /^note\b/,
    /^page\s*\d+\b/,
  ].some((pattern) => pattern.test(q));
}

function hasLikelyQuestionSignal(question: string) {
  const q = question.trim();
  if (!q) return false;

  if (/\?/.test(q)) return true;
  if (/\b(find|determine|evaluate|calculate|compute|solve|identify|which|what|who|when|where|why|how)\b/i.test(q)) {
    return true;
  }
  if (/_{2,}/.test(q)) return true;
  if (/\b(true\s*\/\s*false|assertion|reason)\b/i.test(q)) return true;
  return false;
}

function normalizeCorrectOptionValue(rawCorrectOption: any, optionCount: number) {
  const toIndex = (value: number) => {
    if (!Number.isFinite(value)) return null;
    const n = Math.trunc(value);

    // Preferred: already 0-based
    if (n >= 0 && n < optionCount) return n;
    // Fallback: 1-based coming from OCR/LLM output
    if (n >= 1 && n <= optionCount) return n - 1;
    return null;
  };

  if (typeof rawCorrectOption === "number") {
    return toIndex(rawCorrectOption);
  }

  const rawText = String(rawCorrectOption ?? "").trim();
  if (!rawText) return null;

  // Common letter forms: "A", "Option B", "(C)", "Answer: D"
  const letterMatch = rawText.match(/\b([A-D])\b/i);
  if (letterMatch?.[1]) {
    const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < optionCount) return idx;
  }

  // Numeric forms: "2", "option 3", "correct option: 4"
  const numberMatch = rawText.match(/-?\d+/);
  if (numberMatch) {
    const parsed = Number(numberMatch[0]);
    const normalized = toIndex(parsed);
    if (normalized != null) return normalized;
  }

  return null;
}

export function normalizeImportedItem(item: any, fallbackIndex: number): ImportedQuestionItem {
  const rawQuestion = normalizeMathNotationToLatex(String(item?.question || ""));
  const question = normalizeQuestionText(stripQuestionNumberPrefix(rawQuestion));
  const options = (() => {
    if (Array.isArray(item?.options)) {
      return item.options
        .map((option: any) => normalizeMathNotationToLatex(String(option || "").trim()))
        .filter(Boolean)
        .slice(0, 4);
    }

    if (item?.options && typeof item.options === "object") {
      return ["a", "b", "c", "d"]
        .map((key) => normalizeMathNotationToLatex(String(item.options?.[key] || "").trim()))
        .filter(Boolean)
        .slice(0, 4);
    }

    return [];
  })();

  const correctOption = normalizeCorrectOptionValue(item?.correctOption, options.length);

  const reasons = Array.isArray(item?.reasons)
    ? item.reasons.map((reason: any) => String(reason || "").trim()).filter(Boolean)
    : [];

  let status: ImportedQuestionStatus = item?.status === "ready" || item?.status === "partial" || item?.status === "rejected"
    ? item.status
    : "partial";

  if (!question) reasons.push("Question text could not be extracted.");
  if (question && looksLikeInstructionOrMetaText(question)) {
    reasons.push("Extracted text appears to be instructions/metadata, not a standalone question.");
  }
  if (options.length < 2) reasons.push("At least two options could not be identified.");
  if (correctOption == null || correctOption < 0 || correctOption >= options.length) {
    reasons.push("Correct option could not be identified confidently.");
  }

  const isInstructionLike = question ? looksLikeInstructionOrMetaText(question) : false;
  const lacksQuestionSignal = question ? !hasLikelyQuestionSignal(question) : true;
  const hasCompleteOptionSet = options.length >= 4;
  const shouldTreatAsQuestionLike = question && (!lacksQuestionSignal || hasCompleteOptionSet);

  if (question && !shouldTreatAsQuestionLike) {
    reasons.push("Extracted text does not clearly look like a question statement.");
  }

  if ((!question && !options.length) || isInstructionLike) status = "rejected";
  else if (!question || !shouldTreatAsQuestionLike || options.length < 2 || correctOption == null || correctOption < 0 || correctOption >= options.length) {
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
    rawBlock:
      typeof item?.rawBlock === "string"
        ? normalizeSpecialMathSymbolsToLatex(item.rawBlock)
        : "",
  };
}
