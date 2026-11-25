import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { GUEST, USERS } from '@/lib/mock';
import type { Role, User } from '@/lib/types';

// UI-only: there is no backend, so "signing in" just picks a sample user in memory.
type Session = {
  user: User | null;
  /** A customer who skipped sign-in to write a list straight away. */
  guest: boolean;
  signIn: (role: Role) => void;
  /** Creates a new customer account from the sign-up details. */
  signUp: (profile: { fullName: string; phone: string; email: string }) => void;
  continueAsGuest: () => void;
  signOut: () => void;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const signIn = useCallback((role: Role) => setUser(USERS[role]), []);
  const signUp = useCallback(
    (p: { fullName: string; phone: string; email: string }) =>
      setUser({ id: 'u-new', phone: p.phone ? `+234 ${p.phone}` : null, email: p.email.trim() || null, full_name: p.fullName.trim() || null, role: 'customer', status: 'active' }),
    [],
  );
  const continueAsGuest = useCallback(() => setUser(GUEST), []);
  const signOut = useCallback(() => setUser(null), []);
  const value = useMemo(() => ({ user, guest: user?.id === GUEST.id, signIn, signUp, continueAsGuest, signOut }), [user, signIn, signUp, continueAsGuest, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
