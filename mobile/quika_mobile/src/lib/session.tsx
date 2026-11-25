import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, setToken, setUnauthorizedHandler, type User } from '@/lib/api';

const TOKEN_KEY = 'qyka.token';

type Session = {
  user: User | null;
  isLoading: boolean;
  /** Reads who a token belongs to without signing in (used to check the role the person picked). */
  peek: (accessToken: string) => Promise<User>;
  signIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }, []);

  const peek = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    try {
      return await api.me();
    } finally {
      setToken(null);
    }
  }, []);

  const signIn = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    try {
      setUser(await api.me());
    } catch (e) {
      setToken(null);
      throw e;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  }, []);

  // Restore a saved session on launch.
  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          setToken(saved);
          setUser(await api.me());
        }
      } catch {
        // Expired token or backend unreachable: start signed out.
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo(() => ({ user, isLoading, peek, signIn, signOut }), [user, isLoading, peek, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
