import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import QuickSignIn from '@/components/auth/QuickSignIn';

// One sign-in sheet for the whole app. Anything a guest can't do without an account (placing an order, seeing orders and
// messages, the header chip) asks for it here, and when sign-in finishes the thing they were doing carries on.

type Ask = (reason: string, onSignedIn?: () => void) => void;
const Ctx = createContext<Ask | null>(null);

export function SignInPromptProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ reason: string; done?: () => void } | null>(null);
  const ask = useCallback<Ask>((reason, done) => setOpen({ reason, done }), []);
  const value = useMemo(() => ask, [ask]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <QuickSignIn
        visible={open !== null}
        reason={open?.reason ?? ''}
        onClose={() => setOpen(null)}
        onSignedIn={() => {
          const done = open?.done;
          setOpen(null);
          done?.();
        }}
      />
    </Ctx.Provider>
  );
}

/** Asks a guest to sign in without leaving the screen. `onSignedIn` runs once they're in. */
export function useSignInPrompt(): Ask {
  const a = useContext(Ctx);
  if (!a) throw new Error('useSignInPrompt must be used inside SignInPromptProvider');
  return a;
}
