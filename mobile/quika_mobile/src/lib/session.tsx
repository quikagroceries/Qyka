import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { GUEST, USERS } from '@/lib/mock';
import type { Role, User } from '@/lib/types';

/** Where someone stands on becoming an agent. An approved agent can also shop as a customer, and switch between the two. */
export type AgentStatus = 'none' | 'pending' | 'approved';

// UI-only: there is no backend, so "signing in" just picks a sample user in memory.
type Session = {
  user: User | null;
  /** A customer who skipped sign-in to write a list straight away. */
  guest: boolean;
  signIn: (role: Role) => void;
  /** Creates a new customer account from the sign-up details. */
  signUp: (profile: { fullName: string; phone: string; email: string }) => void;
  continueAsGuest: () => void;
  /** Ends the session. `to` is where the signed-out app lands: the role picker (default) or straight to the sign-in page. */
  signOut: (to?: 'welcome' | 'sign-in') => void;
  /** True from signing out until the next sign-in, so the app skips the intro. */
  justSignedOut: boolean;
  signedOutTo: 'welcome' | 'sign-in' | null;
  /** Saves edits to the signed-in person's details (in memory only). */
  agentStatus: AgentStatus;
  /** The market an agent is assigned to, once they have one. */
  agentMarket: string | null;
  /** Switch between customer and agent. Only an approved agent can; it does nothing otherwise. */
  switchRole: (role: 'customer' | 'agent') => void;
  /** Records a finished agent registration: it is now waiting for review. */
  submitAgentApplication: (market: string) => void;
  /** Stands in for Qyka approving the application (the demo has no reviewer). */
  approveAgent: () => void;
  updateUser: (patch: Partial<Pick<User, 'full_name' | 'email' | 'default_delivery_address' | 'avatar_url'>>) => void;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('none');
  const [signedOutTo, setSignedOutTo] = useState<'welcome' | 'sign-in' | null>(null);
  const [agentMarket, setAgentMarket] = useState<string | null>(null);
  const signIn = useCallback((role: Role) => {
    setUser(USERS[role]);
    setSignedOutTo(null);
    // The sample agent is already approved and assigned to a market.
    setAgentStatus(role === 'agent' ? 'approved' : 'none');
    setAgentMarket(role === 'agent' ? 'Mile 12 Market' : null);
  }, []);
  const signUp = useCallback(
    (p: { fullName: string; phone: string; email: string }) => {
      setSignedOutTo(null);
      setUser({ id: 'u-new', phone: p.phone ? `+234 ${p.phone}` : null, email: p.email.trim() || null, full_name: p.fullName.trim() || null, role: 'customer', status: 'active' });
    },
    [],
  );
  const continueAsGuest = useCallback(() => {
    setUser(GUEST);
    setSignedOutTo(null);
  }, []);
  const signOut = useCallback((to?: 'welcome' | 'sign-in') => {
    setUser(null);
    // Only an explicit 'sign-in' counts: onPress handlers pass an event object here.
    setSignedOutTo(to === 'sign-in' ? 'sign-in' : 'welcome');
    setAgentStatus('none');
    setAgentMarket(null);
  }, []);
  const switchRole = useCallback(
    (role: 'customer' | 'agent') => setUser((u) => (u && agentStatus === 'approved' && (u.role === 'customer' || u.role === 'agent') ? { ...u, role } : u)),
    [agentStatus],
  );
  const submitAgentApplication = useCallback((market: string) => {
    setAgentStatus('pending');
    setAgentMarket(market);
  }, []);
  const approveAgent = useCallback(() => setAgentStatus('approved'), []);
  const updateUser = useCallback((patch: Partial<Pick<User, 'full_name' | 'email' | 'default_delivery_address' | 'avatar_url'>>) => setUser((u) => (u ? { ...u, ...patch } : u)), []);
  const value = useMemo(() => ({ user, guest: user?.id === GUEST.id, signIn, signUp, continueAsGuest, signOut, justSignedOut: signedOutTo !== null, signedOutTo, updateUser, agentStatus, agentMarket, switchRole, submitAgentApplication, approveAgent }), [user, signIn, signUp, continueAsGuest, signOut, signedOutTo, updateUser, agentStatus, agentMarket, switchRole, submitAgentApplication, approveAgent]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
