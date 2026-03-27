import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  extractPdfText,
  normalizeImportedItem,
  parseJsonResponse,
  segmentQuestionCandidates,
  type ImportedQuestionItem,
} from "../_lib/pdfQuestionImport.js";

type ImportRequest = {
  pdfBase64?: string;
  fileName?: string;
  testTitle?: string;
  subject?: string;
};

type ModelResponse = {
  items?: Array<{
    sourceIndex?: number;
    status?: "ready" | "partial" | "rejected";
    question?: string;
    options?: string[];
    correctOption?: number | null;
    reasons?: string[];
    rawBlock?: string;
  }>;
};

function buildSystemPrompt() {
  return `You extract MCQ questions from educational PDF text.

Return ONLY valid JSON in this format:
{
  "items": [
    {
      "sourceIndex": 1,
      "status": "ready|partial|rejected",
      "question": "string",
      "options": ["string"],
      "correctOption": 0,
      "reasons": ["string"],
      "rawBlock": "string"
    }
  ]
}

Rules:
- We only support single-correct MCQ questions.
- Mandatory fields for a ready question are: question, options, correctOption.
- options must be an array with 2 to 4 options only.
- correctOption must be zero-based.
- If the correct answer is not clear, set status to partial and correctOption to null.
- If the block is unusable, set status to rejected.
- Do not invent facts that are not present in the text.
- Preserve the option order from the source block.
- Keep rawBlock short but useful.`;
}

function buildUserPrompt(batch: Array<{ sourceIndex: number; rawBlock: string }>, context: { testTitle?: string; subject?: string }) {
  return `Test title: ${context.testTitle || "Unknown"}
Subject: ${context.subject || "Unknown"}

Extract MCQ questions from these candidate blocks. Some blocks may contain answer keys like "Ans: B" or "Correct option: 2". Use those clues when available.

Candidate blocks:
${JSON.stringify(batch, null, 2)}`;
}

async function callGroq(apiKey: string, batch: Array<{ sourceIndex: number; rawBlock: string }>, context: { testTitle?: string; subject?: string }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(batch, context) },
      ],
      temperature: 0.1,
      max_tokens: 2200,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API error: ${text}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content returned from Groq API");

  return parseJsonResponse<ModelResponse>(content);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { pdfBase64, fileName, testTitle, subject } = (req.body || {}) as ImportRequest;
    if (!pdfBase64) {
      return res.status(400).json({ error: "Missing pdfBase64" });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    const isDev = process.env.NODE_ENV !== "production";
    if (!groqApiKey) {
      return res.status(500).json({ error: isDev ? "GROQ_API_KEY not configured" : "API configuration error" });
    }

    const buffer = Buffer.from(pdfBase64, "base64");
    if (!buffer.length) {
      return res.status(400).json({ error: "Uploaded PDF is empty" });
    }

    const { text, diagnostics } = extractPdfText(buffer);
    if (!text) {
      return res.status(200).json({
        summary: { total: 0, ready: 0, partial: 0, rejected: 0 },
        items: [],
        meta: { fileName, extractedChars: 0, segmentCount: 0, diagnostics },
      });
    }

    const segments = segmentQuestionCandidates(text)
      .map((segment, index) => ({ sourceIndex: index + 1, rawBlock: segment.slice(0, 2400) }))
      .filter((segment) => segment.rawBlock.trim().length >= 15)
      .slice(0, 120);

    if (!segments.length) {
      return res.status(200).json({
        summary: { total: 0, ready: 0, partial: 0, rejected: 0 },
        items: [],
        meta: { fileName, extractedChars: text.length, segmentCount: 0, diagnostics: [...diagnostics, "No candidate question blocks found."] },
      });
    }

    const results: ImportedQuestionItem[] = [];
    const batchSize = 8;
    for (let i = 0; i < segments.length; i += batchSize) {
      const batch = segments.slice(i, i + batchSize);
      const parsed = await callGroq(groqApiKey, batch, { testTitle, subject });
      const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];

      if (!rawItems.length) {
        for (const item of batch) {
          results.push(
            normalizeImportedItem(
              {
                sourceIndex: item.sourceIndex,
                status: "rejected",
                question: "",
                options: [],
                correctOption: null,
                reasons: ["AI could not parse this question block."],
                rawBlock: item.rawBlock,
              },
              item.sourceIndex
            )
          );
        }
        continue;
      }

      for (let offset = 0; offset < batch.length; offset += 1) {
        const source = batch[offset];
        const candidate = rawItems.find((entry) => Number(entry?.sourceIndex) === source.sourceIndex) || rawItems[offset] || {
          sourceIndex: source.sourceIndex,
          status: "rejected",
          question: "",
          options: [],
          correctOption: null,
          reasons: ["AI did not return a structured result for this block."],
          rawBlock: source.rawBlock,
        };

        results.push(normalizeImportedItem({ ...candidate, rawBlock: candidate.rawBlock || source.rawBlock }, source.sourceIndex));
      }
    }

    const unique = results.filter((item, index, arr) => {
      if (item.status === "rejected") return true;
      const signature = `${item.question.toLowerCase()}__${item.options.join("||").toLowerCase()}`;
      return arr.findIndex((entry) => entry.status !== "rejected" && `${entry.question.toLowerCase()}__${entry.options.join("||").toLowerCase()}` === signature) === index;
    });

    const summary = unique.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        return acc;
      },
      { total: 0, ready: 0, partial: 0, rejected: 0 }
    );

    return res.status(200).json({
      summary,
      items: unique,
      meta: {
        fileName,
        extractedChars: text.length,
        segmentCount: segments.length,
        diagnostics,
      },
    });
  } catch (error) {
    console.error("Error in import-test-questions:", error);
    const isDev = process.env.NODE_ENV !== "production";
    return res.status(500).json({ error: isDev ? String(error) : "Internal server error" });
  }
}
