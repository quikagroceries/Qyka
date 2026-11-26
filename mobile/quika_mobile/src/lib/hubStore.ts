import { useEffect, useSyncExternalStore } from 'react';

import { api } from '@/lib/api';
import type { HubOrder } from '@/lib/types';

// The hub's orders, from the server: goods agents have dropped, checked in, and waiting for riders. The hub list and each order's page
// read this one store. There is no push yet, so a screen using it asks again every few seconds.

export type Handover = { id: string; rider: string; at: string };
type State = { orders: HubOrder[]; handed: Handover[]; hubName: string | null; loaded: boolean; error: string };

let state: State = { orders: [], handed: [], hubName: null, loaded: false, error: '' };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const upsert = (order: HubOrder) => set({ orders: state.orders.some((o) => o.id === order.id) ? state.orders.map((o) => (o.id === order.id ? order : o)) : [order, ...state.orders] });

/** Items that were actually bought: the only ones the hub should expect in the bag. */
export const boughtItems = (o: HubOrder) => o.items.filter((i) => i.availability !== 'unavailable' && i.availability !== 'dropped');

export const hub = {
  async refresh() {
    try {
      // The hub's own name comes once; the orders every time.
      const [orders, me] = await Promise.all([api.getHubOrders(), state.hubName ? Promise.resolve(null) : api.getMyHub()]);
      set({ orders, hubName: me ? me.name : state.hubName, loaded: true, error: '' });
    } catch (e) {
      set({ loaded: true, error: (e as Error).message });
    }
  },
  /** What the shopkeeper saw in the bag, with photos. Moves the order to "checked in". Throws the server's message if it refuses. */
  async checkIn(id: string, seenIds: string[], note: string, photoUris: string[]) {
    const photos = await Promise.all(photoUris.map((u) => api.uploadImage(u)));
    upsert(await api.receiveHubOrder(id, { received_item_ids: seenIds, ...(note.trim() ? { note: note.trim() } : {}), ...(photos.length > 0 ? { photos } : {}) }));
  },
  /** Bagged and waiting: riders can now claim it. */
  async markReady(id: string) {
    upsert(await api.markHubOrderReady(id));
  },
  /** Hand the bag to the rider, but only if the code they show matches the one the server gave them. Throws the server's message if not. */
  async handOver(id: string, code: string) {
    const before = state.orders.find((o) => o.id === id);
    await api.handoverHubOrder(id, code);
    set({ handed: [{ id, rider: before?.rider_name ?? 'The rider', at: new Date().toISOString() }, ...state.handed] });
    await hub.refresh();
  },
  /** A different person is signing in, or this one signed out. */
  reset() {
    set({ orders: [], handed: [], hubName: null, loaded: false, error: '' });
  },
};

export const useHub = () => useSyncExternalStore(subscribe, () => state);
/** One order at the hub, or undefined once it has left (handed over) or if there is none with that id. */
export const useHubOrder = (id?: string) => useHub().orders.find((o) => o.id === id);

/** Keeps the hub's orders fresh while a screen is open. */
export function useHubSync(ms = 6000) {
  useEffect(() => {
    void hub.refresh();
    const t = setInterval(() => void hub.refresh(), ms);
    return () => clearInterval(t);
  }, [ms]);
}
