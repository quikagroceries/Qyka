import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type LanguageCode = 'en' | 'pcm';

export const LANGUAGES: { code: LanguageCode; native: string; description: string }[] = [
  { code: 'en', native: 'English', description: 'Use Qyka in English' },
  { code: 'pcm', native: 'Naijá', description: 'Use Qyka in Pidgin' },
];

// UI only for now: the choice lives in memory, and no screen is translated yet.
type Ctx = { language: LanguageCode; chosen: boolean; choose: (code: LanguageCode) => void };

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [chosen, setChosen] = useState(false);
  const choose = useCallback((code: LanguageCode) => {
    setLanguage(code);
    setChosen(true);
  }, []);
  const value = useMemo(() => ({ language, chosen, choose }), [language, chosen, choose]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Ctx {
  const c = useContext(LanguageContext);
  if (!c) throw new Error('useLanguage must be used inside LanguageProvider');
  return c;
}
