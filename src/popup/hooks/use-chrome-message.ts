import { useState, useCallback } from "react";
import { sendToBackground } from "@/shared/messaging";
import type { PopupToSWMessage } from "@/shared/types";

interface UseMessageState<TResponse> {
  data: TResponse | null;
  loading: boolean;
  error: string | null;
  send: () => Promise<TResponse | null>;
}

/**
 * Hook for sending a message to the background service worker.
 * Manages loading/error state automatically.
 */
export function useChromeMessage<TResponse>(message: PopupToSWMessage): UseMessageState<TResponse> {
  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await sendToBackground(message);
      const typed = response as TResponse;
      setData(typed);
      setLoading(false);
      return typed;
    } catch (err) {
      const errorMsg = String(err);
      setError(errorMsg);
      setLoading(false);
      return null;
    }
  }, [message]);

  return { data, loading, error, send };
}
