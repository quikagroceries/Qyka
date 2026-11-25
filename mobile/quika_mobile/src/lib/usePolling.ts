import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Runs `fn` now and every `ms` while the app is in the foreground. */
export function usePolling(fn: () => void | Promise<void>, ms: number) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      void ref.current();
      timer = setInterval(() => void ref.current(), ms);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    // Pause in the background (saves battery and data), refresh on return.
    const sub = AppState.addEventListener('change', (s) => {
      stop();
      if (s === 'active') start();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [ms]);
}
