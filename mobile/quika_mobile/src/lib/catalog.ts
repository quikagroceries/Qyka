import { useEffect, useState } from 'react';

import { api, type Pricing, type ServerMarket } from '@/lib/api';

// What the server says about markets and prices. Fetched once and kept, so every screen shares it.

/** Used until the server answers (and if it can't be reached), so the order flow still has numbers to show. */
const DEFAULT_PRICING = { serviceFeeRate: 0.075, deliveryFee: 1500, depositRate: 0.3, addItemFee: 500 };
export type PricingView = typeof DEFAULT_PRICING;

const fromServer = (p: Pricing): PricingView => ({
  serviceFeeRate: Number(p.service_fee_percent) / 100,
  deliveryFee: Number(p.delivery_fee),
  depositRate: Number(p.deposit_percent) / 100,
  addItemFee: Number(p.add_item_fee),
});

let pricingCache: PricingView | null = null;
let marketsCache: ServerMarket[] | null = null;

export function usePricing(): PricingView {
  const [pricing, setPricing] = useState<PricingView>(pricingCache ?? DEFAULT_PRICING);
  useEffect(() => {
    if (pricingCache) return;
    let alive = true;
    api.getPricing().then((p) => {
      pricingCache = fromServer(p);
      if (alive) setPricing(pricingCache);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return pricing;
}

export function useMarkets(): { markets: ServerMarket[]; loading: boolean; error: string; retry: () => void } {
  const [markets, setMarkets] = useState<ServerMarket[]>(marketsCache ?? []);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (marketsCache && tick === 0) return;
    let alive = true;
    api.getMarkets()
      .then((m) => {
        marketsCache = m.filter((x) => x.is_active);
        if (alive) setMarkets(marketsCache);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [tick]);
  return {
    markets,
    loading: markets.length === 0 && !error,
    error,
    retry: () => {
      setError('');
      setTick((t) => t + 1);
    },
  };
}

/** Whether a market is open right now, in its own time zone. Opening is inclusive, closing exclusive; a window can cross midnight. */
export function marketOpenNow(m: { opening_time?: string | null; closing_time?: string | null; timezone?: string | null }): boolean {
  if (!m.opening_time || !m.closing_time) return true;
  let local = '';
  try {
    local = new Date().toLocaleTimeString('en-GB', { timeZone: m.timezone || 'Africa/Lagos', hour12: false, hour: '2-digit', minute: '2-digit' });
  } catch {
    return true;
  }
  const open = m.opening_time.slice(0, 5);
  const close = m.closing_time.slice(0, 5);
  return open < close ? local >= open && local < close : local >= open || local < close;
}

/** "08:00" from the server's "08:00:00". */
export const clock = (t?: string | null) => (t ? t.slice(0, 5) : '');
