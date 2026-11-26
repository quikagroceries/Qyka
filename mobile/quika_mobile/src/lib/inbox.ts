import { useEffect, useSyncExternalStore } from 'react';

import { api } from '@/lib/api';
import { getToken } from '@/lib/token';
import type { Conversation } from '@/lib/types';

// The messages inbox from the server. There is no push yet, so a screen using it asks again every few seconds.

type InboxState = { items: Conversation[]; loaded: boolean; error: string };
let inbox: InboxState = { items: [], loaded: false, error: '' };
const inboxListeners = new Set<() => void>();
const setInbox = (next: Partial<InboxState>) => {
  inbox = { ...inbox, ...next };
  inboxListeners.forEach((l) => l());
};
const subscribeInbox = (l: () => void) => {
  inboxListeners.add(l);
  return () => {
    inboxListeners.delete(l);
  };
};

export const inboxStore = {
  async refresh() {
    if (!getToken()) return;
    try {
      setInbox({ items: await api.getConversations(), loaded: true, error: '' });
    } catch (e) {
      setInbox({ loaded: true, error: (e as Error).message });
    }
  },
  /** A different person is signing in, or this one signed out. */
  reset() {
    setInbox({ items: [], loaded: false, error: '' });
  },
};

/** The inbox: every order chat the person is on, newest first. Asked for again every few seconds while a screen uses it. */
export function useConversations(ms = 8000) {
  const state = useSyncExternalStore(subscribeInbox, () => inbox);
  useEffect(() => {
    void inboxStore.refresh();
    const t = setInterval(() => void inboxStore.refresh(), ms);
    return () => clearInterval(t);
  }, [ms]);
  return { ...state, reload: inboxStore.refresh };
}
