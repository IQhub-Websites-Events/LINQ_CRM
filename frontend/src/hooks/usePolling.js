import { useEffect } from "react";

/**
 * Silently re-runs a refetch function on a fixed interval.
 * Only fires when the tab is visible — skips hidden/backgrounded tabs.
 */
export function usePolling(refetchFn, intervalMs = 30000) {
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refetchFn();
    }, intervalMs);
    return () => clearInterval(id);
  }, [refetchFn, intervalMs]);
}
