import { VercelResponse } from "@vercel/node";

/**
 * Streaming response types
 */
export type StreamProgressEvent = {
  type: "progress" | "complete" | "error";
  message?: string;
  data?: any;
  error?: string;
};

/**
 * Send a streaming JSON response
 * Each event is sent as: data: {json}\n\n
 */
export function sendStreamEvent(res: VercelResponse, event: StreamProgressEvent) {
  // Check if response hasn't been ended
  if (res.writableEnded) {
    console.warn("[sendStreamEvent] Response already ended, cannot send event:", event.type);
    return;
  }
  
  const json = JSON.stringify(event);
  try {
    res.write(`data: ${json}\n\n`);
  } catch (err) {
    console.error("[sendStreamEvent] Error writing to response:", err);
  }
}

/**
 * Initialize streaming response headers
 */
export function initializeStreaming(res: VercelResponse) {
  // Only set headers if they haven't been sent yet
  if (!res.headersSent) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
}

/**
 * Close streaming response
 */
export function endStreaming(res: VercelResponse) {
  // Check if response hasn't been ended
  if (res.writableEnded) {
    console.warn("[endStreaming] Response already ended");
    return;
  }
  
  try {
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[endStreaming] Error closing response:", err);
    // Response might already be closed, that's okay
  }
}

/**
 * Handle errors in streaming context
 */
export function streamError(res: VercelResponse, error: unknown) {
  if (res.writableEnded) {
    console.error("[streamError] Response already ended, cannot send error");
    return;
  }

  const message =
    error instanceof Error ? error.message : "An unknown error occurred";

  // User-friendly error messages
  const userFriendlyMessage = getUserFriendlyErrorMessage(message);

  try {
    sendStreamEvent(res, {
      type: "error",
      error: userFriendlyMessage,
    });
    endStreaming(res);
  } catch (err) {
    console.error("[streamError] Failed to send error:", err);
  }
}

/**
 * Convert technical errors to user-friendly messages
 */
export function getUserFriendlyErrorMessage(technicalError: string): string {
  // Map specific errors to user-friendly messages
  const errorMap: Record<string, string> = {
    "GEMINI_API_KEY is not configured": "AI service is not properly configured. Please contact support.",
    "Gemini returned an empty response": "Failed to get a response from AI service. Please try again.",
    "404": "The requested AI model is not available. Please try again later.",
    "429": "Too many requests. Please wait a moment and try again.",
    "500": "AI service encountered an error. Please try again later.",
    "TIMEOUT": "The operation took too long. Please try again with a simpler request.",
    "NETWORK": "Network error. Please check your connection and try again.",
    "INVALID_REQUEST": "Invalid request. Please check your input and try again.",
  };

  // Check if any key matches the error
  for (const [key, message] of Object.entries(errorMap)) {
    if (technicalError.includes(key)) {
      return message;
    }
  }

  // Default message
  return "Something went wrong while processing your request. Please try again.";
}

/**
 * Validate AbortSignal and throw if aborted
 */
export function checkAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new Error("Request was cancelled by user");
  }
}

