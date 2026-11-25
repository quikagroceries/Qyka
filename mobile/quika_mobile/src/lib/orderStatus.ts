// Mirrors frontend/src/lib/orderStatus.ts (the parts the customer app needs).
import type { AgentOrder } from '@/lib/types';

export const HISTORY = new Set(['delivered', 'closed', 'cancelled', 'cancelled_unpaid']);
export const EXCEPTION = new Set(['cancelled', 'cancelled_unpaid', 'disputed']);
export const CHAT = new Set(['agent_assigned', 'shopping']);
export const RATEABLE = new Set(['delivered', 'closed']);
// Before finish-shopping runs, the bill fields are still 0.00: show the estimate.
export const UNPRICED = new Set(['draft', 'proposed', 'agent_assigned', 'shopping']);
export const PAID_OR_LATER = new Set([
  'paid', 'dropped_at_hub', 'received_by_hub', 'ready_for_pickup', 'packed', 'out_for_delivery', 'delivered', 'closed',
]);
export const ON_THE_MOVE = new Set(['paid', 'dropped_at_hub', 'received_by_hub', 'ready_for_pickup', 'packed', 'out_for_delivery']);

export const isHistory = (s: string) => HISTORY.has(s);

export function summarize(o: AgentOrder, marketName?: string | null): string {
  const at = marketName ? ` at ${marketName}` : '';
  switch (o.status) {
    case 'draft': return 'Pick up where you left off: list not sent yet';
    case 'proposed': return 'Finding you an agent';
    case 'agent_assigned': return `Agent assigned${at}: shopping starts soon`;
    case 'shopping': {
      const bought = o.items.filter((it) => it.confirmed_price != null).length;
      return `Agent is shopping${at}: ${bought} of ${o.items.length} bought`;
    }
    case 'awaiting_payment': return 'Shopping done: pay the balance';
    case 'paid': return 'Paid: your agent is taking it to the hub';
    case 'dropped_at_hub': return 'At the market hub: waiting for check-in';
    case 'received_by_hub': return 'Checked in at the hub';
    case 'ready_for_pickup':
    case 'packed': return 'Ready: waiting for a rider';
    case 'out_for_delivery': return 'On its way to you';
    case 'delivered':
    case 'closed': return 'Delivered';
    case 'cancelled':
    case 'cancelled_unpaid': return 'Order cancelled';
    case 'disputed': return 'Order under review';
    default: return o.status.replaceAll('_', ' ');
  }
}
