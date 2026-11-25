import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

export type PricingRules = { serviceFeeRate: number; deliveryFee: number; depositRate: number };

// The owner can change these at any time, so always refetch once per mount;
// the fallback only covers the moment before the first response.
const FALLBACK: PricingRules = { serviceFeeRate: 0.075, deliveryFee: 1500, depositRate: 0.3 };
let cached: PricingRules | null = null;

export function usePricing(): PricingRules {
  const [p, setP] = useState<PricingRules>(cached ?? FALLBACK);
  useEffect(() => {
    let live = true;
    api
      .pricing()
      .then((r) => {
        cached = {
          serviceFeeRate: Number(r.service_fee_percent) / 100,
          deliveryFee: Number(r.delivery_fee),
          depositRate: Number(r.deposit_percent) / 100,
        };
        if (live) setP(cached);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return p;
}

/** Are new orders open? Off only when an owner has paused them. */
export function useOrdersOpen(): { open: boolean; message: string | null } {
  const [s, setS] = useState({ open: true, message: null as string | null });
  useEffect(() => {
    let live = true;
    api
      .platformStatus()
      .then((r) => live && setS({ open: !r.orders_paused, message: r.message }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return s;
}
