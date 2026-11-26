import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { Earnings } from '@/lib/types';

/** A rider's or a hub's earnings from the server: what's been earned, and each order's fee. Asked for again every so often. */
export function useServerEarnings(kind: 'rider' | 'hub', ms = 30000) {
  const [state, setState] = useState<{ data: Earnings | null; error: string; loaded: boolean }>({ data: null, error: '', loaded: false });
  useEffect(() => {
    let alive = true;
    const load = () =>
      (kind === 'rider' ? api.getRiderEarnings() : api.getHubEarnings())
        .then((data) => alive && setState({ data, error: '', loaded: true }))
        .catch((e: Error) => alive && setState((s) => ({ ...s, error: e.message, loaded: true })));
    void load();
    const t = setInterval(() => void load(), ms);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [kind, ms]);
  return state;
}
