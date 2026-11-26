import { useSyncExternalStore } from 'react';

import { HUB_ORDERS } from '@/lib/mock';
import { orderStore } from '@/lib/orderStore';
import type { HubOrder, RiderJob } from '@/lib/types';

// UI only: the hub's orders live here, in memory, and the rider app reads and writes the SAME records, so the two
// agree: marking an order ready puts a job in the rider's list, the rider's claim gives the hub a code to check,
// and handing over only works with that code. A real hub would do all of this through the backend.

export type Handover = { id: string; rider: string; at: string };
type State = { orders: HubOrder[]; handed: Handover[] };

let state: State = { orders: HUB_ORDERS.map((o) => ({ ...o })), handed: [] };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};
const patch = (id: string, change: Partial<HubOrder>) => set({ ...state, orders: state.orders.map((o) => (o.id === id ? { ...o, ...change } : o)) });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => state;

export const useHub = () => useSyncExternalStore(subscribe, snapshot);
export const useHubOrder = (id?: string) => {
  const { orders } = useHub();
  return orders.find((o) => o.id === id) ?? orders[0];
};

/** Items that were actually bought: the only ones the hub should expect in the bag. */
export const boughtItems = (o: HubOrder) => o.items.filter((i) => i.availability !== 'unavailable' && i.availability !== 'dropped');

/** An order as the rider sees it as a job. The pickup code only shows once that rider has claimed it. */
const asJob = (o: HubOrder): RiderJob => ({
  id: o.id,
  status: o.status,
  hub_id: 'h-1',
  hub_name: 'Mile 12 Hub',
  market_name: 'Mile 12 Market',
  item_count: boughtItems(o).length,
  ready_at: o.ready_at ?? null,
  claimed_at: o.rider_name ? new Date().toISOString() : null,
  pickup_code: o.rider_code ?? null,
  customer_name: 'Ada Okafor',
  customer_phone: '08012345678',
  delivery_address: '12 Adeola Odeku St, Victoria Island',
  dropoff_latitude: 6.4281,
  dropoff_longitude: 3.4219,
  delivered_at: null,
});

/** Orders the hub has marked ready that no rider has claimed yet: the rider's pool. */
export const useHubJobs = (): RiderJob[] => useHub().orders.filter((o) => o.status === 'ready_for_pickup' && !o.rider_name).map(asJob);
/** One of those orders as a job (including its pickup code once claimed). */
export const useHubJob = (id: string | null): RiderJob | null => {
  const { orders } = useHub();
  const o = id ? orders.find((x) => x.id === id) : null;
  return o ? asJob(o) : null;
};

/** The customer's order a hub order belongs to. */
const linked = (id: string) => state.orders.find((o) => o.id === id)?.customer_order_id;
/** Same, for a screen: the customer's order id for the hub order the rider claimed. */
export const useCustomerOrderId = (hubId: string | null): string | null => {
  const { orders } = useHub();
  return (hubId ? orders.find((o) => o.id === hubId)?.customer_order_id : null) ?? null;
};

const fourDigits = () => String(1000 + Math.floor(Math.random() * 9000));

export const hub = {
  /** What the shopkeeper saw in the bag. Moves the order to "checked in". */
  checkIn(id: string, missingIds: string[], note: string) {
    patch(id, { status: 'received_by_hub', hub_received_at: new Date().toISOString(), hub_missing_item_ids: missingIds, hub_receipt_note: note.trim() || null });
    const c = linked(id);
    if (c) orderStore.setStatus(c, 'received_by_hub');
  },
  /** Bagged and waiting: it is now a job riders can claim. */
  markReady(id: string) {
    patch(id, { status: 'ready_for_pickup', ready_at: new Date().toISOString(), rider_waiting: false, rider_name: null, rider_code: null });
    const c = linked(id);
    if (c) orderStore.setStatus(c, 'ready_for_pickup');
  },
  /** A rider claims the job and gets a pickup code to show at the hub. */
  claim(id: string, rider: string) {
    const o = state.orders.find((x) => x.id === id);
    if (!o || o.status !== 'ready_for_pickup' || o.rider_name) return;
    patch(id, { rider_name: rider, rider_waiting: true, rider_code: fourDigits() });
  },
  /** The rider gives the job back, or never turned up: it goes back to the pool. */
  releaseClaim(id: string) {
    patch(id, { rider_name: null, rider_waiting: false, rider_code: null });
  },
  /** Hand the bag to the rider, but only if the code they show matches. Returns whether it did. */
  handOver(id: string, code: string): boolean {
    const o = state.orders.find((x) => x.id === id);
    if (!o || !o.rider_waiting || !o.rider_code || code !== o.rider_code) return false;
    patch(id, { status: 'out_for_delivery', rider_waiting: false });
    // The customer's order goes out for delivery too, and they get the code to give the rider at the door.
    const c = linked(id);
    if (c) orderStore.dispatch(c);
    set({ ...state, handed: [{ id, rider: o.rider_name ?? 'The rider', at: new Date().toISOString() }, ...state.handed] });
    return true;
  },
  /** Demo only: the agent arrives and drops the goods at the hub. */
  simulateAgentArrives(id: string) {
    patch(id, { status: 'dropped_at_hub', dropped_at_hub_at: new Date().toISOString() });
  },
};
