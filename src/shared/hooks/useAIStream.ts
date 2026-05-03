import { useCallback, useRef, useState } from "react";

export type AIStreamEvent = {
  type: "progress" | "complete" | "error";
  message?: string;
  data?: any;
  error?: string;
};

export type UseAIStreamReturn = {
  data: any | null;
  loading: boolean;
  error: string | null;
  progress: string | null;
  cancel: () => void;
  request: (
    url: string,
    body: Record<string, any>
  ) => Promise<any>;
};

/**
 * Hook for handling streaming AI requests with progress updates and cancellation
 * 
 * Features:
 * - Real-time progress updates
 * - AbortController support for cancellation
 * - User-friendly error messages
 * - Automatic cleanup
 */
export function useAIStream(): UseAIStreamReturn {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setProgress(null);
    }
  }, []);

  const request = useCallback(
    async (url: string, body: Record<string, any>) => {
      // Reset state
      setData(null);
      setError(null);
      setProgress(null);
      setLoading(true);

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok && response.status !== 200) {
          // Try to parse error message
          try {
            const errorData = await response.json();
            throw new Error(
              errorData.error || `Request failed with status ${response.status}`
            );
          } catch {
            throw new Error(
              `Request failed with status ${response.status}`
            );
          }
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let finalData: any = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Process all complete lines
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();

            if (line.startsWith("data: ")) {
              const jsonStr = line.substring(6).trim();

              if (jsonStr === "[DONE]") {
                break;
              }

              try {
                const event: AIStreamEvent = JSON.parse(jsonStr);

                if (event.type === "progress" && event.message) {
                  setProgress(event.message);
                } else if (event.type === "complete" && event.data) {
                  finalData = event.data;
                  setData(event.data);
                  setProgress(null);
                } else if (event.type === "error" && event.error) {
                  throw new Error(event.error);
                }
              } catch (parseError) {
                console.error("Failed to parse stream event:", parseError);
              }
            }
          }

          // Keep the last incomplete line in the buffer
          buffer = lines[lines.length - 1];
        }

        setLoading(false);
        return finalData;
      } catch (err) {
        // Don't set error if request was cancelled
        if (err instanceof Error && err.name === "AbortError") {
          setLoading(false);
          return null;
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred";
        
        setError(errorMessage);
        setLoading(false);
        throw new Error(errorMessage);
      }
    },
    []
  );

  return {
    data,
    loading,
    error,
    progress,
    cancel,
    request,
  };
}
