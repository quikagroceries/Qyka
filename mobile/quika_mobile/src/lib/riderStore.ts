import { useEffect, useSyncExternalStore } from 'react';

import { api } from '@/lib/api';
import type { Earnings, RiderJob } from '@/lib/types';

// The rider's jobs, from the server: orders the hub has ready for anyone to claim (the pool), and the job this rider has claimed.
// There is no push yet, so a screen using it asks again every few seconds.

type State = { pool: RiderJob[]; mine: RiderJob[]; earnings: Earnings | null; loaded: boolean; error: string };
let state: State = { pool: [], mine: [], earnings: null, loaded: false, error: '' };
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

export const rider = {
  async refresh() {
    try {
      const [pool, mine, earnings] = await Promise.all([api.getRiderJobs(), api.getMyRiderJobs(), api.getRiderEarnings()]);
      set({ pool, mine, earnings, loaded: true, error: '' });
    } catch (e) {
      set({ loaded: true, error: (e as Error).message });
    }
  },
  /** Takes a job (the server allows one at a time) and gets the code to show at the hub. Throws the server's message if refused. */
  async claim(id: string) {
    await api.claimRiderJob(id);
    await rider.refresh();
  },
  /** Gives a job back before collecting it. */
  async release(id: string) {
    await api.releaseRiderJob(id);
    await rider.refresh();
  },
  /** Hands the order to the customer, with the code they give at the door. Throws the server's message if the code is wrong. The job stays
   *  in the rider's list, with a delivery time, until the customer confirms; then it drops off. */
  async deliver(id: string, code: string) {
    await api.deliverRiderJob(id, code);
    await rider.refresh();
  },
  reset() {
    set({ pool: [], mine: [], earnings: null, loaded: false, error: '' });
  },
};

export const useRider = () => useSyncExternalStore(subscribe, () => state);

/** Keeps the rider's jobs fresh while a screen is open. */
export function useRiderSync(ms = 5000) {
  useEffect(() => {
    void rider.refresh();
    const t = setInterval(() => void rider.refresh(), ms);
    return () => clearInterval(t);
  }, [ms]);
}
