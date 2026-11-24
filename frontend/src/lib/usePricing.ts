"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// The fee rules a NEW order would be priced by. They're set by an owner (Admin
// > Platform settings), so the app reads them from the server instead of
// carrying its own copy. The defaults below are only what shows for the
// instant before the first response (and if the server can't be reached).
export type Pricing = {
  serviceFeeRate: number;   // 0.075 = 7.5%
  deliveryFee: number;
  depositRate: number;      // 0.3 = 30%
  addItemFee: number;
  /** What an agent earns for a normal shop (before any time-based extra). */
  agentBasePay: number;
  /** Fixed pay per delivery for a rider / per order for a hub (default; a market can set its own). */
  riderPay: number;
  hubPay: number;
  loaded: boolean;
};

const FALLBACK: Pricing = {
  serviceFeeRate: 0.075, deliveryFee: 1500, depositRate: 0.3, addItemFee: 500,
  agentBasePay: 1000, riderPay: 1000, hubPay: 500, loaded: false,
};

let cached: Pricing | null = null;
let inflight: Promise<Pricing> | null = null;

function load(): Promise<Pricing> {
  if (!inflight) {
    inflight = api.getPricing()
      .then((p: any) => {
        cached = {
          serviceFeeRate: Number(p.service_fee_percent) / 100,
          deliveryFee: Number(p.delivery_fee),
          depositRate: Number(p.deposit_percent) / 100,
          addItemFee: Number(p.add_item_fee),
          agentBasePay: Number(p.agent_base_pay),
          riderPay: Number(p.rider_pay),
          hubPay: Number(p.hub_pay),
          loaded: true,
        };
        return cached;
      })
      .catch(() => FALLBACK)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function usePricing(): Pricing {
  const [pricing, setPricing] = useState<Pricing>(cached ?? FALLBACK);
  useEffect(() => {
    // Always refresh once per mount: an owner may have changed the rules since the last visit.
    let live = true;
    load().then((p) => live && setPricing(p));
    return () => { live = false; };
  }, []);
  return pricing;
}

/** Are new orders open? Off only when an owner has paused them. */
export function useOrdersOpen(): { open: boolean; message: string | null } {
  const [state, setState] = useState<{ open: boolean; message: string | null }>({ open: true, message: null });
  useEffect(() => {
    let live = true;
    api.getPlatformStatus()
      .then((s: any) => live && setState({ open: !s.orders_paused, message: s.message }))
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return state;
}
