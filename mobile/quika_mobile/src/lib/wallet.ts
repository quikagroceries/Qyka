import { useEffect, useSyncExternalStore } from 'react';

import { api, type WalletEntry } from '@/lib/api';
import { getToken } from '@/lib/token';

// The customer's wallet: the balance, and every credit and debit. Read by the wallet screen, the Account page and the payment box,
// so a top-up or a payment shows everywhere. Asked for again every few seconds while a screen uses it.

type State = { balance: string | null; entries: WalletEntry[]; loaded: boolean; error: string };
let state: State = { balance: null, entries: [], loaded: false, error: '' };
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

export const walletStore = {
  async refresh() {
    if (!getToken()) return;
    try {
      const [wallet, entries] = await Promise.all([api.getWallet(), api.getWalletTransactions()]);
      set({ balance: wallet.balance, entries, loaded: true, error: '' });
    } catch (e) {
      set({ loaded: true, error: (e as Error).message });
    }
  },
  /** Just the balance, for places that don't show the history. */
  async refreshBalance() {
    if (!getToken()) return;
    try {
      set({ balance: (await api.getWallet()).balance });
    } catch {
      // The next full refresh will report any problem.
    }
  },
  /** A different person is signing in, or this one signed out. */
  reset() {
    set({ balance: null, entries: [], loaded: false, error: '' });
  },
};

export const useWallet = () => useSyncExternalStore(subscribe, () => state);

/** Keeps the wallet fresh while a screen is open. */
export function useWalletSync(ms = 15000) {
  useEffect(() => {
    void walletStore.refresh();
    const t = setInterval(() => void walletStore.refresh(), ms);
    return () => clearInterval(t);
  }, [ms]);
}
