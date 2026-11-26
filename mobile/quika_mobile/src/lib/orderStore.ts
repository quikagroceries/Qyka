import { useEffect, useSyncExternalStore } from 'react';

import { api } from '@/lib/api';
import { getToken } from '@/lib/token';
import type { AgentOrder } from '@/lib/types';

// Orders, from the server. Every screen that shows them reads one store, so a change shows up everywhere. The server has no push
// yet, so screens ask again every few seconds while open. There is one store for the customer's orders and one for the agent's.

type State = { orders: AgentOrder[]; loaded: boolean; error: string };

function makeOrderStore(fetchList: () => Promise<AgentOrder[]>) {
  let state: State = { orders: [], loaded: false, error: '' };
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
  const newestFirst = (list: AgentOrder[]) => [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const upsert = (order: AgentOrder) => set({ orders: newestFirst([order, ...state.orders.filter((o) => o.id !== order.id)]) });

  const store = {
    /** Fetches the person's orders. A failed refresh keeps what is on screen and records why. */
    async refresh() {
      if (!getToken()) return; // a guest has no orders to ask for
      try {
        set({ orders: newestFirst(await fetchList()), loaded: true, error: '' });
      } catch (e) {
        set({ loaded: true, error: (e as Error).message });
      }
    },
    /** Fetches one order (so its page works even if the list hasn't loaded) and updates it in the list. Returns an error message, or null. */
    async load(id: string) {
      if (!getToken()) return null;
      try {
        upsert(await api.getOrder(id));
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    /** An order the server just returned (placed, paid, accepted...). */
    upsert,
    /** Forget everything: a different person is signing in, or this one signed out. */
    reset() {
      set({ orders: [], loaded: false, error: '' });
    },
  };

  const useOrderState = () => useSyncExternalStore(subscribe, () => state);
  const useOrders = (): AgentOrder[] => useOrderState().orders;
  /** One order, or undefined if there isn't one with that id. */
  const useOrder = (id?: string | null): AgentOrder | undefined => useOrders().find((o) => o.id === id);
  /** Keeps the list fresh while a screen is open: loads now, then again every `ms`. */
  function useOrdersSync(ms = 8000) {
    useEffect(() => {
      void store.refresh();
      const t = setInterval(() => void store.refresh(), ms);
      return () => clearInterval(t);
    }, [ms]);
  }
  /** Keeps one order fresh while its page is open. */
  function useOrderSync(id?: string | null, ms = 6000) {
    useEffect(() => {
      if (!id) return;
      void store.load(id);
      const t = setInterval(() => void store.load(id), ms);
      return () => clearInterval(t);
    }, [id, ms]);
  }
  return { store, useOrderState, useOrders, useOrder, useOrdersSync, useOrderSync };
}

// The customer's orders.
const customer = makeOrderStore(() => api.myCustomerOrders());
export const orderStore = customer.store;
export const { useOrderState, useOrders, useOrder, useOrdersSync, useOrderSync } = customer;

// The orders an agent is shopping.
const agent = makeOrderStore(() => api.myAgentOrders());
export const agentOrderStore = agent.store;
export const useAgentOrderState = agent.useOrderState;
export const useAgentOrders = agent.useOrders;
export const useAgentOrder = agent.useOrder;
export const useAgentOrdersSync = agent.useOrdersSync;
export const useAgentOrderSync = agent.useOrderSync;
