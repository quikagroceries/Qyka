import { useSyncExternalStore } from 'react';

import { ORDERS } from '@/lib/mock';
import type { AgentOrder } from '@/lib/types';

// UI only: the customer's orders live here, in memory, so the screens that show them (Track, the order page, Account)
// and the people who move them along (the hub, the rider) all read and change the SAME records.
// A real app would do this through the backend's order endpoints.

type State = { orders: AgentOrder[] };
let state: State = { orders: ORDERS.map((o) => ({ ...o })) };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};
const patch = (id: string, change: Partial<AgentOrder>) => set({ orders: state.orders.map((o) => (o.id === id ? { ...o, ...change } : o)) });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => state;

export const useOrders = (): AgentOrder[] => useSyncExternalStore(subscribe, snapshot).orders;
/** One order, or undefined if there isn't one with that id. */
export const useOrder = (id?: string | null): AgentOrder | undefined => useOrders().find((o) => o.id === id);

export const orderStore = {
  /** A customer just placed this order: it goes to the top of their list. */
  add(order: AgentOrder) {
    set({ orders: [order, ...state.orders] });
  },
  setStatus(id: string, status: string, extra: Partial<AgentOrder> = {}) {
    patch(id, { status, ...extra });
  },
  /** The hub handed it to the rider: it is out for delivery, and the customer gets the code to give at the door. */
  dispatch(id: string): string {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    patch(id, { status: 'out_for_delivery', handover_code: code, dispatched_at: new Date().toISOString() });
    return code;
  },
  /** The rider entered the customer's code and says it was handed over. The customer is asked to confirm. */
  riderDelivered(id: string) {
    patch(id, { rider_delivered_at: new Date().toISOString() });
  },
};
