export function logError(error: unknown, context: string): void {
  const err = error instanceof Error ? error : new Error(String(error));

  // fire-and-forget — never await this, never let it throw
  fetch("/api/log-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: err.message,
      stack: err.stack?.replace(`Error: ${err.message}\n`, ""),
      context,
    }),
  }).catch(() => {});
}
