import { useEffect, useSyncExternalStore } from 'react';

import { api, type AppNotification } from '@/lib/api';

// The person's notifications. The server has no push channel, so the app asks again every so often while it is open.
// Read by the bell in the header (unread count) and the notifications screen.

type State = { items: AppNotification[]; unread: number; loaded: boolean; error: string };
let state: State = { items: [], unread: 0, loaded: false, error: '' };
const listeners = new Set<() => void>();
const set = (items: AppNotification[], extra: Partial<State> = {}) => {
  state = { ...state, items, unread: items.filter((n) => !n.is_read).length, ...extra };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const notificationStore = {
  async refresh() {
    try {
      set(await api.notifications(), { loaded: true, error: '' });
    } catch (e) {
      state = { ...state, loaded: true, error: (e as Error).message };
      listeners.forEach((l) => l());
    }
  },
  async markRead(id: string) {
    set(state.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await api.markNotificationRead(id);
    } catch {
      void notificationStore.refresh();
    }
  },
  async markAllRead() {
    set(state.items.map((n) => ({ ...n, is_read: true })));
    try {
      await api.markAllNotificationsRead();
    } catch {
      void notificationStore.refresh();
    }
  },
  reset() {
    state = { items: [], unread: 0, loaded: false, error: '' };
    listeners.forEach((l) => l());
  },
};

export const useNotifications = () => useSyncExternalStore(subscribe, () => state);

/** Keeps the list (and so the bell's badge) fresh while the header is on screen. */
export function useNotificationSync(enabled: boolean, ms = 20000) {
  useEffect(() => {
    if (!enabled) return;
    void notificationStore.refresh();
    const t = setInterval(() => void notificationStore.refresh(), ms);
    return () => clearInterval(t);
  }, [enabled, ms]);
}
