/**
 * Shared question type definitions for the test engine.
 * Supports MCQ, Short Answer, and Upload Answer question types.
 * 
 * All existing questions default to "MCQ" for backward compatibility.
 */

export type QuestionType = "MCQ" | "SHORT_ANSWER" | "UPLOAD";

export const QUESTION_TYPES: QuestionType[] = ["MCQ", "SHORT_ANSWER", "UPLOAD"];

export const QUESTION_TYPE_CONFIG: Record<
  QuestionType,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeColor: string;
    supportsOptions: boolean;
    supportsNegativeMarks: boolean;
    supportsCorrectOption: boolean;
    requiresReferenceAnswer: boolean;
    requiresAiEvaluation: boolean;
    studentInputType: "radio" | "textarea" | "file";
  }
> = {
  MCQ: {
    label: "Multiple Choice Question",
    shortLabel: "MCQ",
    description: "Students select one correct option from multiple choices",
    badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
    supportsOptions: true,
    supportsNegativeMarks: true,
    supportsCorrectOption: true,
    requiresReferenceAnswer: false,
    requiresAiEvaluation: false,
    studentInputType: "radio",
  },
  SHORT_ANSWER: {
    label: "Short Answer Question",
    shortLabel: "Short Ans",
    description: "Students write a short textual answer",
    badgeColor: "bg-orange-100 text-orange-700 border-orange-200",
    supportsOptions: false,
    supportsNegativeMarks: true,
    supportsCorrectOption: false,
    requiresReferenceAnswer: true,
    requiresAiEvaluation: true,
    studentInputType: "textarea",
  },
  UPLOAD: {
    label: "Upload Answer Question",
    shortLabel: "Upload",
    description: "Students upload an image of their handwritten answer",
    badgeColor: "bg-purple-100 text-purple-700 border-purple-200",
    supportsOptions: false,
    supportsNegativeMarks: true,
    supportsCorrectOption: false,
    requiresReferenceAnswer: false,
    requiresAiEvaluation: true,
    studentInputType: "file",
  },
};

/** Returns the config for a given question type, defaulting to MCQ */
export function getQuestionTypeConfig(type?: string) {
  const normalized = normalizeQuestionType(type);
  return QUESTION_TYPE_CONFIG[normalized];
}

/** Returns a human-readable label for a question type */
export function getQuestionTypeLabel(type?: string): string {
  return getQuestionTypeConfig(type).label;
}

/** Returns the short label for badges/tags */
export function getQuestionTypeShortLabel(type?: string): string {
  return getQuestionTypeConfig(type).shortLabel;
}

/** Check if a question type requires AI evaluation (subjective) */
export function isSubjectiveType(type?: string): boolean {
  return getQuestionTypeConfig(type).requiresAiEvaluation;
}

/** Normalize any stored question type to a valid QuestionType, defaulting to MCQ */
export function normalizeQuestionType(type?: string | null): QuestionType {
  if (!type) return "MCQ";
  const upper = String(type).toUpperCase().trim();
  if (upper === "MCQ" || upper === "MULTIPLE_CHOICE") return "MCQ";
  if (upper === "SHORT_ANSWER" || upper === "SHORT" || upper === "SUBJECTIVE") return "SHORT_ANSWER";
  if (upper === "UPLOAD" || upper === "FILE_UPLOAD" || upper === "IMAGE_UPLOAD") return "UPLOAD";
  return "MCQ";
}

/** AI evaluation result shape stored in attempt responses */
export type AiEvaluationResult = {
  score: number;
  maxScore: number;
  confidence: number;
  feedback: string;
  evaluatedAt?: number;
};
