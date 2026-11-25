import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Ctx = { done: boolean; finish: () => void };

const SplashContext = createContext<Ctx | null>(null);

/** Whether the splash overlay has finished, so screens underneath can hold their entrance until it has. */
export function SplashProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);
  const finish = useCallback(() => setDone(true), []);
  const value = useMemo(() => ({ done, finish }), [done, finish]);
  return <SplashContext.Provider value={value}>{children}</SplashContext.Provider>;
}

export function useSplash(): Ctx {
  const c = useContext(SplashContext);
  if (!c) throw new Error('useSplash must be used inside SplashProvider');
  return c;
}
