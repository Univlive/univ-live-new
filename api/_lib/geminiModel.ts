const FALLBACK_MODEL = "gemini-1.5-flash";

function cleanModelName(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Normalizes configured Gemini model names and maps common aliases/typos.
 * Keeps backend resilient when production env uses shorthand names.
 */
export function resolveGeminiModelName(input?: string | null) {
  const configured = cleanModelName(input);
  if (!configured) return FALLBACK_MODEL;

  // Accept common shorthand aliases used in envs.
  if (configured === "gemini-2-flash") return "gemini-1.5-flash";
  if (configured === "gemini-3-flash-preview") return "gemini-1.5-flash";

  return configured;
}

export function getGeminiModelNameFromEnv() {
  return resolveGeminiModelName(process.env.GEMINI_MODEL);
}
