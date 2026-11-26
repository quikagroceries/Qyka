import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, toUser, type ServerUser } from '@/lib/api';
import { GUEST } from '@/lib/mock';
import { hub } from '@/lib/hubStore';
import { agentData } from '@/lib/agentData';
import { notificationStore } from '@/lib/notifications';
import { inboxStore } from '@/lib/inbox';
import { rider } from '@/lib/riderStore';
import { walletStore } from '@/lib/wallet';
import { agentOrderStore, orderStore } from '@/lib/orderStore';
import { clearToken, loadToken, saveToken, setUnauthorizedHandler } from '@/lib/token';
import type { User } from '@/lib/types';

/** Where someone stands on becoming an agent. An approved agent can also shop as a customer, and switch between the two. */
export type AgentStatus = 'none' | 'pending' | 'approved';

type Session = {
  user: User | null;
  /** False while the saved sign-in is being checked on start; the app shows its loading screen until then. */
  ready: boolean;
  /** A customer who skipped sign-in to write a list straight away (no account, no token). */
  guest: boolean;
  /** Completes a sign-in with the token the server gave after the code was verified. */
  acceptToken: (token: string) => Promise<void>;
  continueAsGuest: () => void;
  /** Ends the session. `to` is where the signed-out app lands: the role picker (default) or straight to the sign-in page. */
  signOut: (to?: 'welcome' | 'sign-in') => void;
  /** True from signing out until the next sign-in, so the app skips the intro. */
  justSignedOut: boolean;
  signedOutTo: 'welcome' | 'sign-in' | null;
  agentStatus: AgentStatus;
  /** The market an agent is assigned to, once they have one. */
  agentMarket: string | null;
  /** Switch between the customer view and the agent view. The server refuses while an order is live; the message is thrown. */
  switchRole: (role: 'customer' | 'agent') => Promise<void>;
  /** Records a finished agent registration: it is now waiting for review. (Not sent to the server yet.) */
  submitAgentApplication: (market: string) => void;
  /** Saves edits. Name and address go to the server; email and photo are kept on this phone for now. */
  updateUser: (patch: Partial<Pick<User, 'full_name' | 'email' | 'default_delivery_address' | 'default_delivery_landmark' | 'default_delivery_latitude' | 'default_delivery_longitude' | 'avatar_url'>>) => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

/** An agent account can be viewed as an agent or as a customer; the server remembers which. Everyone else is just themselves. */
async function viewFor(me: ServerUser): Promise<User> {
  const u = toUser(me);
  if (me.role !== 'agent' || !me.has_customer_side) return u;
  try {
    const duty = await api.agentMe();
    return duty.on_duty ? u : { ...u, role: 'customer' };
  } catch {
    return u;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('none');
  const [signedOutTo, setSignedOutTo] = useState<'welcome' | 'sign-in' | null>(null);
  const [agentMarket, setAgentMarket] = useState<string | null>(null);

  const signOut = useCallback((to?: 'welcome' | 'sign-in') => {
    void clearToken();
    orderStore.reset();
    agentOrderStore.reset();
    agentData.reset();
    hub.reset();
    rider.reset();
    walletStore.reset();
    inboxStore.reset();
    notificationStore.reset();
    setUser(null);
    // Only an explicit 'sign-in' counts: onPress handlers pass an event object here.
    setSignedOutTo(to === 'sign-in' ? 'sign-in' : 'welcome');
    setAgentStatus('none');
    setAgentMarket(null);
  }, []);

  const acceptToken = useCallback(async (token: string) => {
    orderStore.reset();
    agentOrderStore.reset();
    agentData.reset();
    hub.reset();
    rider.reset();
    walletStore.reset();
    inboxStore.reset();
    notificationStore.reset();
    await saveToken(token);
    try {
      const me = await api.me();
      setSignedOutTo(null);
      setUser(await viewFor(me));
      setAgentStatus(me.role === 'agent' ? 'approved' : 'none');
    } catch (e) {
      await clearToken();
      throw e;
    }
  }, []);

  // On start: if there's a saved sign-in, check it's still good. Any later 401 signs out (see api.ts).
  useEffect(() => {
    setUnauthorizedHandler(() => signOut());
    let alive = true;
    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          const me = await api.me();
          const view = await viewFor(me);
          if (alive) {
            setUser(view);
            setAgentStatus(me.role === 'agent' ? 'approved' : 'none');
          }
        } catch {
          // Expired, or the server can't be reached: start signed out. (A 401 already cleared the token.)
        }
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
      setUnauthorizedHandler(null);
    };
  }, [signOut]);

  const continueAsGuest = useCallback(() => {
    setUser(GUEST);
    setSignedOutTo(null);
  }, []);
  const switchRole = useCallback(
    async (role: 'customer' | 'agent') => {
      if (agentStatus !== 'approved') return;
      // On duty is the agent view; off duty is the customer view. The server refuses to leave the agent view while an order is live.
      await api.setDuty(role === 'agent');
      setUser((u) => (u && (u.role === 'customer' || u.role === 'agent') ? { ...u, role } : u));
    },
    [agentStatus],
  );
  const submitAgentApplication = useCallback((market: string) => {
    setAgentStatus('pending');
    setAgentMarket(market);
  }, []);

  const updateUser = useCallback(async (patch: Partial<Pick<User, 'full_name' | 'email' | 'default_delivery_address' | 'default_delivery_landmark' | 'default_delivery_latitude' | 'default_delivery_longitude' | 'avatar_url'>>) => {
    const server: Parameters<typeof api.updateProfile>[0] = {};
    if (patch.full_name) server.full_name = patch.full_name;
    if ('default_delivery_address' in patch) {
      server.default_delivery_address = patch.default_delivery_address ?? null;
      server.default_delivery_landmark = patch.default_delivery_landmark ?? null;
      server.default_delivery_latitude = patch.default_delivery_latitude ?? null;
      server.default_delivery_longitude = patch.default_delivery_longitude ?? null;
    }
    let saved: Partial<User> = {};
    if (Object.keys(server).length > 0) {
      const u = toUser(await api.updateProfile(server));
      saved = { full_name: u.full_name, default_delivery_address: u.default_delivery_address, default_delivery_landmark: u.default_delivery_landmark, default_delivery_latitude: u.default_delivery_latitude, default_delivery_longitude: u.default_delivery_longitude };
    }
    // The server has no endpoint for email or photo yet (email needs its own verification), so those stay on this phone.
    setUser((cur) => (cur ? { ...cur, ...saved, ...('email' in patch ? { email: patch.email } : {}), ...('avatar_url' in patch ? { avatar_url: patch.avatar_url } : {}) } : cur));
  }, []);

  const value = useMemo(
    () => ({ user, ready, guest: user?.id === GUEST.id, acceptToken, continueAsGuest, signOut, justSignedOut: signedOutTo !== null, signedOutTo, updateUser, agentStatus, agentMarket, switchRole, submitAgentApplication }),
    [user, ready, acceptToken, continueAsGuest, signOut, signedOutTo, updateUser, agentStatus, agentMarket, switchRole, submitAgentApplication],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
