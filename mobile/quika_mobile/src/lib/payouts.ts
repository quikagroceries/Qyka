import { useCallback, useEffect, useState } from 'react';

import { api, type Payout, type PayoutSummary } from '@/lib/api';
import { errMsg } from '@/lib/format';

/** What can be withdrawn, the saved bank account and past withdrawals. `reload` asks the server again. */
export function usePayouts() {
  const [state, setState] = useState<{ summary: PayoutSummary | null; history: Payout[]; error: string; loaded: boolean }>({ summary: null, history: [], error: '', loaded: false });
  const reload = useCallback(async () => {
    try {
      const [summary, history] = await Promise.all([api.payoutSummary(), api.myPayouts()]);
      setState({ summary, history, error: '', loaded: true });
    } catch (e) {
      setState((s) => ({ ...s, error: errMsg(e), loaded: true }));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { ...state, reload };
}

/** Just the amount that can be withdrawn, for the Earnings screens. Null until known. */
export function useAvailable(): string | null {
  const [available, setAvailable] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .payoutSummary()
      .then((s) => alive && setAvailable(s.available))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return available;
}

export const STATUS_LABEL: Record<string, { text: string; tone: 'ok' | 'wait' | 'bad' }> = {
  paid: { text: 'Sent', tone: 'ok' },
  processing: { text: 'On its way', tone: 'wait' },
  pending_review: { text: 'Under review', tone: 'wait' },
  failed: { text: 'Failed', tone: 'bad' },
  rejected: { text: 'Not approved', tone: 'bad' },
};
