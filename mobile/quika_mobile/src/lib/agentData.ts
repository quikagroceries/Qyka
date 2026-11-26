import { useEffect, useSyncExternalStore } from 'react';

import { api, type AgentSummary } from '@/lib/api';
import { useMarkets } from '@/lib/catalog';

// The signed-in agent's own numbers: today's earnings, what's pending, and whether they are on duty. Asked for again every
// so often while a screen uses it.

type State = { summary: AgentSummary | null; marketId: string | null; loaded: boolean; error: string };
let state: State = { summary: null, marketId: null, loaded: false, error: '' };
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

export const agentData = {
  async refresh() {
    try {
      const [summary, me] = await Promise.all([api.agentSummary(), api.agentMe()]);
      set({ summary, marketId: me.assigned_market_id, loaded: true, error: '' });
    } catch (e) {
      set({ loaded: true, error: (e as Error).message });
    }
  },
  /** Pauses or resumes new orders. An order already in progress isn't affected. */
  async setAvailable(on: boolean) {
    await api.setAvailability(on);
    await agentData.refresh();
  },
  reset() {
    set({ summary: null, marketId: null, loaded: false, error: '' });
  },
};

export function useAgentData(ms = 20000, enabled = true) {
  const s = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!enabled) return;
    void agentData.refresh();
    const t = setInterval(() => void agentData.refresh(), ms);
    return () => clearInterval(t);
  }, [ms, enabled]);
  return s;
}

/** The market the signed-in agent is assigned to (by name), once the server has said. Only asks while `enabled`, i.e. for agents. */
export function useAssignedMarket(enabled: boolean): string | null {
  const { marketId } = useAgentData(60000, enabled);
  const { markets } = useMarkets();
  return (enabled && markets.find((m) => m.id === marketId)?.name) || null;
}
