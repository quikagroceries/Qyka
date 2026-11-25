import { API_BASE } from '@/lib/config';

export type Role = 'customer' | 'agent' | 'rider' | 'shopkeeper' | 'admin';

export type User = {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  role: Role;
  status: string;
  default_delivery_address?: string | null;
  must_prepay?: boolean;
};

export type OtpResponse = {
  detail: string;
  channel: string;
  dev_otp: string | null;
  expires_in_seconds: number;
};

export type RiderJob = {
  id: string;
  status: string;
  hub_id: string | null;
  hub_name: string | null;
  market_name: string | null;
  item_count: number;
  ready_at: string | null;
  claimed_at: string | null;
  // Only filled in for the rider who has claimed the job:
  pickup_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  delivered_at: string | null;
};

export type Earnings = {
  earnings_today: string;
  earnings_week: string;
  earnings_total: string;
  completed_count: number;
  recent: { order_id: string; amount: string; delivered_at: string }[];
};

export type HubItem = { id: string; description: string; quantity: number | null; requested_note: string | null };

export type HubOrder = {
  id: string;
  status: string;
  agent_name: string | null;
  rider_name: string | null;
  rider_waiting: boolean;
  items: HubItem[];
  packing_photos: string[];
  dropped_at_hub_at: string | null;
  hub_received_at: string | null;
  hub_missing_item_ids: string[];
  hub_receipt_note: string | null;
};

export type OrderItem = {
  id: string;
  description: string;
  requested_note: string | null;
  listed_price: string | null;
  quantity: number | null;
  preferred_stall_id: string | null;
  availability: string;
  confirmed_price: string | null;
  vendor_transfer_id: string | null;
  overage_requested_price: string | null;
  overage_decision: string | null;
};

export type AgentOrder = {
  id: string;
  status: string;
  market_id: string;
  items: OrderItem[];
  packing_photos: string[] | null;
  dropped_at_hub_at: string | null;
  // Customer-facing fields (money arrives as decimal strings):
  agent_id: string | null;
  items_total: string;
  combined_fee: string;
  delivery_fee: string;
  delivery_quote: string;
  emtl_total: string;
  transfer_fees_total: string;
  grand_total: string;
  goods_estimate: string;
  deposit_amount: string;
  deposit_paid_at: string | null;
  created_at: string;
  agent_assigned_at: string | null;
  paid_at: string | null;
  hub_id: string | null;
  hub_received_at: string | null;
  packed_at: string | null;
  rider_claimed_at: string | null;
  rider_delivered_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  handover_code: string | null;
  delivery_address: string | null;
};

export type Person = { id: string; full_name: string | null; avatar_url: string | null; phone?: string };

export type Market = {
  id: string;
  slug?: string;
  name: string;
  city?: string | null;
  state?: string | null;
  description?: string | null;
  venue_type?: string;
  image_url?: string | null;
  categories?: string[];
  opening_time?: string | null;
  closing_time?: string | null;
  timezone?: string | null;
};

export type Pricing = {
  service_fee_percent: string;
  delivery_fee: string;
  deposit_percent: string;
};

export type NewOrderBody = {
  market_id: string;
  delivery_address: string;
  listed_items_total: string;
  items: { description: string; listed_price?: string; quantity?: number; requested_note?: string }[];
  dropoff_latitude?: number | null;
  dropoff_longitude?: number | null;
};
export type Vendor = { id: string; name: string };
export type Hub = { id: string; name: string };
export type Purchase = { id: string; amount: string; account_number: string; photo_ref: string | null };

export type Message = {
  id: string;
  order_id: string;
  sender_id: string;
  text: string | null;
  image_url: string | null;
  created_at: string;
};

export type Conversation = {
  order_id: string;
  order_status: string;
  market_name: string | null;
  other: { id: string; full_name: string | null; avatar_url: string | null } | null;
  last_message: { text: string | null; has_image: boolean; sender_id: string; created_at: string };
  unread: number;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(t: string | null) {
  token = t;
}
// Called on any 401 while signed in, so an expired token signs the user out
// from wherever they are instead of leaving screens that silently fail.
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

// FastAPI errors are { detail: string } or { detail: [{ msg }] }.
function readDetail(text: string): string {
  try {
    const d = JSON.parse(text)?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  } catch {}
  return text || 'Something went wrong';
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_BASE}. Is the backend running?`);
  }
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, readDetail(text));
  }
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  requestOtp: (identifier: string, channel?: 'sms' | 'whatsapp' | 'voice') =>
    request<OtpResponse>('/auth/request-otp', {
      method: 'POST',
      body: { identifier, ...(channel ? { channel } : {}) },
    }),
  // `role` is only honoured by the backend outside production, for accounts that
  // don't exist yet (a dev convenience so each role can be tried).
  verifyOtp: (identifier: string, code: string, role?: string) =>
    request<{ access_token: string }>('/auth/verify-otp', {
      method: 'POST',
      body: { identifier, code, ...(role ? { role } : {}) },
    }),
  me: () => request<User>('/auth/me'),

  // Rider: claim from the pool, collect at the hub with the pickup code,
  // deliver with the customer's PIN.
  riderPool: () => request<RiderJob[]>('/riders/jobs'),
  riderMine: () => request<RiderJob[]>('/riders/jobs/mine'),
  riderClaim: (id: string) => request<RiderJob>(`/riders/jobs/${id}/claim`, { method: 'POST' }),
  riderRelease: (id: string) => request<RiderJob>(`/riders/jobs/${id}/release`, { method: 'POST' }),
  riderDeliver: (id: string, code: string) =>
    request<RiderJob>(`/riders/jobs/${id}/deliver`, { method: 'POST', body: { code } }),
  riderEarnings: () => request<Earnings>('/riders/earnings'),

  // Shopkeeper (hub): check in what an agent dropped, mark it ready, and hand
  // it to the rider who shows their code. Item names only, no prices.
  hub: () => request<{ id: string; name: string }>('/hubs/me'),
  hubOrders: () => request<HubOrder[]>('/hubs/orders'),
  hubOrder: (id: string) => request<HubOrder>(`/hubs/orders/${id}`),
  hubReceive: (id: string, body: { received_item_ids?: string[]; note?: string; photos?: string[] }) =>
    request<HubOrder>(`/hubs/orders/${id}/receive`, { method: 'POST', body }),
  hubReady: (id: string) => request<HubOrder>(`/hubs/orders/${id}/ready`, { method: 'POST' }),
  hubHandover: (id: string, code: string) =>
    request<HubOrder>(`/hubs/orders/${id}/handover`, { method: 'POST', body: { code } }),
  hubEarnings: () => request<Earnings>('/hubs/earnings'),

  // Agent: shop the market, pay stalls directly, then take the goods to a hub.
  agentOrders: () => request<AgentOrder[]>('/orders/mine'),
  order: (id: string) => request<AgentOrder>(`/orders/${id}`),
  markets: () => request<Market[]>('/markets'),
  marketVendors: (marketId: string) => request<Vendor[]>(`/markets/${marketId}/vendors`),
  createVendor: (marketId: string, body: { name: string; stall_description?: string }) =>
    request<Vendor>(`/markets/${marketId}/vendors`, { method: 'POST', body }),
  startShopping: (id: string) => request<unknown>(`/orders/${id}/start-shopping`, { method: 'POST' }),
  releaseOrder: (id: string) => request<unknown>(`/orders/${id}/release`, { method: 'POST' }),
  finishShopping: (id: string) => request<unknown>(`/orders/${id}/finish-shopping`, { method: 'POST' }),
  flagUnavailable: (id: string, itemId: string) =>
    request<unknown>(`/orders/${id}/items/${itemId}/unavailable`, { method: 'POST' }),
  requestOverage: (id: string, itemId: string, price: string) =>
    request<unknown>(`/orders/${id}/items/${itemId}/request-overage`, { method: 'POST', body: { price } }),
  payVendor: (
    id: string,
    body: { account_number: string; bank_code: string; items: { item_id: string; price: string }[]; photo_ref?: string },
  ) => request<unknown>(`/jit/orders/${id}/pay-vendor`, { method: 'POST', body }),
  purchases: (id: string) => request<Purchase[]>(`/jit/orders/${id}/purchases`),
  attachPurchasePhoto: (id: string, transferId: string, photoRef: string) =>
    request<unknown>(`/jit/orders/${id}/purchases/${transferId}/photo`, { method: 'POST', body: { photo_ref: photoRef } }),
  hubsForMarket: (marketId: string) => request<Hub[]>(`/hubs?market_id=${marketId}`),
  dropAtHub: (id: string, hubId?: string) =>
    request<unknown>(`/delivery/orders/${id}/drop-at-hub`, { method: 'POST', body: hubId ? { hub_id: hubId } : {} }),
  addPackingPhotos: (id: string, refs: string[]) =>
    request<unknown>(`/delivery/orders/${id}/packing-photos`, { method: 'POST', body: { refs } }),

  // Order chat (customer <-> agent).
  messages: (orderId: string) => request<Message[]>(`/orders/${orderId}/messages`),
  sendMessage: (orderId: string, body: { text?: string; image_url?: string }) =>
    request<Message>(`/orders/${orderId}/messages`, { method: 'POST', body }),
  markChatRead: (orderId: string) => request<null>(`/orders/${orderId}/messages/read`, { method: 'POST' }),
  conversations: () => request<Conversation[]>('/chat/conversations'),

  // Customer: follow an order, approve what the agent asks, and pay.
  customerOrders: () => request<AgentOrder[]>('/orders/mine-customer'),
  orderAgent: (id: string) => request<Person>(`/orders/${id}/agent`),
  proposedAgent: (id: string) => request<Person>(`/orders/${id}/proposed-agent`),
  acceptAgent: (id: string) => request<unknown>(`/orders/${id}/accept-agent`, { method: 'POST' }),
  seeAnotherAgent: (id: string) =>
    request<{ outcome: string; order: AgentOrder }>(`/orders/${id}/see-another-agent`, { method: 'POST' }),
  authorization: (id: string) => request<{ cap: string; spent: string }>(`/jit/orders/${id}/authorization`),
  raiseCap: (id: string, extra: string) =>
    request<unknown>(`/jit/orders/${id}/authorization/raise`, { method: 'POST', body: { extra } }),
  decideItem: (id: string, itemId: string, decision: 'buy_elsewhere' | 'dropped') =>
    request<unknown>(`/orders/${id}/items/${itemId}/decide`, { method: 'POST', body: { decision } }),
  decideOverage: (id: string, itemId: string, decision: 'approved' | 'declined') =>
    request<unknown>(`/orders/${id}/items/${itemId}/overage-decide`, { method: 'POST', body: { decision } }),
  confirmDelivery: (id: string) => request<unknown>(`/delivery/orders/${id}/confirm-delivery`, { method: 'POST' }),
  cancelOrder: (id: string) => request<unknown>(`/orders/${id}/cancel`, { method: 'POST' }),
  rating: (id: string) => request<{ stars: number; comment: string | null } | null>(`/orders/${id}/rating`),
  rateAgent: (id: string, stars: number, comment: string | null) =>
    request<unknown>(`/orders/${id}/rating`, { method: 'POST', body: { stars, comment } }),
  walletBalance: () => request<{ balance: string }>('/wallet'),
  // Payments. Bank transfer opens Paystack in the browser; we verify with the
  // reference we get back, so no redirect back into the app is needed.
  payDepositWallet: (id: string) => request<unknown>(`/payments/orders/${id}/deposit/pay-from-wallet`, { method: 'POST' }),
  payBalanceWallet: (id: string) => request<unknown>(`/payments/orders/${id}/pay-from-wallet`, { method: 'POST' }),
  checkoutDeposit: (id: string) =>
    request<{ authorization_url: string | null; reference: string }>(`/payments/orders/${id}/deposit/checkout`, { method: 'POST', body: {} }),
  checkoutBalance: (id: string) =>
    request<{ authorization_url: string | null; reference: string }>(`/payments/orders/${id}/checkout`, { method: 'POST', body: {} }),
  verifyDeposit: (id: string, reference: string) =>
    request<unknown>(`/payments/orders/${id}/deposit/checkout/verify`, { method: 'POST', body: { reference } }),
  verifyBalance: (id: string, reference: string) =>
    request<unknown>(`/payments/orders/${id}/checkout/verify`, { method: 'POST', body: { reference } }),
  fundWallet: (amount: string) =>
    request<{ authorization_url: string | null; reference: string }>('/payments/wallet/fund/init', { method: 'POST', body: { amount } }),
  verifyFunding: (reference: string) =>
    request<unknown>('/payments/wallet/fund/verify', { method: 'POST', body: { reference } }),

  // New order.
  pricing: () => request<Pricing>('/pricing'),
  platformStatus: () => request<{ orders_paused: boolean; message: string | null }>('/status'),
  createOrder: (body: NewOrderBody) => request<AgentOrder>('/orders', { method: 'POST', body }),
  saveAddress: (address: string) => request<User>('/auth/me', { method: 'PATCH', body: { default_delivery_address: address } }),
};
