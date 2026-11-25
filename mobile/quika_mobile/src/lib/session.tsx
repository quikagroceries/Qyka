import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { USERS } from '@/lib/mock';
import type { Role, User } from '@/lib/types';

// UI-only: there is no backend, so "signing in" just picks a sample user in memory.
type Session = {
  user: User | null;
  signIn: (role: Role) => void;
  signOut: () => void;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const signIn = useCallback((role: Role) => setUser(USERS[role]), []);
  const signOut = useCallback(() => setUser(null), []);
  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
