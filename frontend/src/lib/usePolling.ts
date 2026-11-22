"use client";

import { useEffect, useRef } from "react";

/**
 * Poll `fn` every `intervalMs` - but only while someone can see it:
 *  - Paused while the tab/app is hidden (Page Visibility API); on coming
 *    back it fetches once straight away, then resumes the interval.
 *  - Never stacks requests: a tick is skipped while the previous call is
 *    still running (a slow network can't pile polls on top of each other).
 *  - Cleared on unmount, and restarted when `deps` change (e.g. orderId).
 *
 * `intervalMs` may change between renders (e.g. faster while an order is
 * being shopped); the timer picks the new value up on its next restart.
 * Pass `intervalMs <= 0` to stop polling (the initial fetch still runs).
 */
export function usePolling(fn: () => unknown, intervalMs: number, deps: unknown[] = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let running = false;
    let cancelled = false;

    const tick = async () => {
      if (running || cancelled) return;
      running = true;
      try {
        await fnRef.current();
      } catch {
        // callers handle their own errors; a failed poll just waits for the next
      } finally {
        running = false;
      }
    };
    const start = () => {
      if (timer || intervalMs <= 0) return;
      timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };

    tick();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart on the caller's deps and on interval changes
  }, [...deps, intervalMs]);
}
