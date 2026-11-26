import { fireUnauthorized, getToken } from '@/lib/token';
import type { AgentOrder, Conversation, Earnings, HubOrder, Market, Message, Purchase, Role, RiderJob, User } from '@/lib/types';

// Where the backend is. Set EXPO_PUBLIC_API_URL in .env.local (see there for local vs hosted).
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

/** A request that failed, with a message that is safe to show. `status` is 0 when the server couldn't be reached. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The backend answers errors as { detail: "..." } or, for bad input, { detail: [{ msg }, ...] }.
function messageFrom(body: string, status: number): string {
  try {
    const j = JSON.parse(body);
    if (typeof j.detail === 'string') return j.detail;
    if (Array.isArray(j.detail)) return j.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('. ');
  } catch {
    // Not JSON: fall through.
  }
  return status >= 500 ? 'Something went wrong on our side. Please try again.' : body || 'Something went wrong.';
}

async function request<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "Can't reach Qyka right now. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!res.ok) {
    // A 401 on a request that carried a token means the token is no longer good.
    if (res.status === 401 && token) fireUnauthorized();
    throw new ApiError(res.status, messageFrom(text, res.status));
  }
  return (text ? JSON.parse(text) : null) as T;
}

// --- Shapes the server sends (only the fields the app uses) -------------------------------------

export type ServerUser = {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url?: string | null;
  default_delivery_address: string | null;
  default_delivery_landmark?: string | null;
  default_delivery_latitude?: number | null;
  default_delivery_longitude?: number | null;
  role: Role;
  status: string;
  must_prepay: boolean;
  has_customer_side: boolean;
};

export type OtpChannel = 'sms' | 'whatsapp' | 'voice' | 'email';
export type OtpSent = { detail: string; channel: OtpChannel; dev_otp: string | null; expires_in_seconds: number };

/** The server's user, as the app's own user shape. */
export const toUser = (u: ServerUser): User => ({
  id: u.id,
  phone: u.phone,
  email: u.email,
  full_name: u.full_name,
  role: u.role,
  status: u.status,
  default_delivery_address: u.default_delivery_address,
  default_delivery_landmark: u.default_delivery_landmark ?? null,
  default_delivery_latitude: u.default_delivery_latitude ?? null,
  default_delivery_longitude: u.default_delivery_longitude ?? null,
  avatar_url: u.avatar_url ?? null,
  must_prepay: u.must_prepay,
  has_customer_side: u.has_customer_side,
});

export type Pricing = { service_fee_percent: string; delivery_fee: string; deposit_percent: string; add_item_fee: string };
export type ServerMarket = Market & { is_active: boolean; status: string };
/** The proposed agent includes a phone number; the assigned agent (after accepting) does not. */
export type ProposedAgent = { id: string; full_name: string | null; phone?: string; avatar_url?: string | null };

/** What the customer sends to place an order. Money is sent as strings, as the server expects. */
export type NewOrderBody = {
  market_id: string;
  delivery_address: string;
  delivery_landmark?: string;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
  listed_items_total: string;
  items: { description: string; listed_price?: string; quantity?: number; requested_note?: string }[];
};

// Photos go straight to Cloudinary (the server never handles image bytes) and the server only accepts links on our own account.
// These are the same public values the web app uses; set EXPO_PUBLIC_CLOUDINARY_* to point at a different account.
const CLOUDINARY_CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'y0vuqbu5';
const CLOUDINARY_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'quika_chat';

/** Uploads a photo from this phone and returns its link. */
export async function uploadImage(uri: string): Promise<string> {
  const form = new FormData();
  form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('upload_preset', CLOUDINARY_PRESET);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: form, signal: controller.signal });
    if (!res.ok) throw new ApiError(res.status, "Couldn't upload the photo. Please try again.");
    const data = (await res.json()) as { secure_url?: string };
    if (!data.secure_url) throw new ApiError(500, "Couldn't upload the photo. Please try again.");
    return data.secure_url;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "Couldn't upload the photo. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

export type AgentSummary = {
  earnings_today: string;
  earnings_week: string;
  earnings_total: string;
  /** Paid for but not yet delivered: released to the agent when the customer confirms. */
  earnings_pending: string;
  ready_to_shop_count: number;
  in_progress_count: number;
  is_available: boolean;
  on_duty: boolean;
  completed_orders: { id: string; agent_share: string; delivered_at: string | null; status: string }[];
};
export type Vendor = { id: string; market_id: string; name: string; stall_description: string | null };
/** One line of the wallet's history. */
export type WalletEntry = { id: string; order_id: string | null; direction: 'credit' | 'debit' | string; amount: string; balance_after: string; note: string | null; created_at: string };
export type PlaceSuggestion = { place_id: string; title: string; subtitle: string };
export type PlaceDetails = { place_id: string; address: string; latitude: number; longitude: number };
export type AppNotification = { id: string; order_id: string | null; kind: string; message: string; is_read: boolean; created_at: string };
export type NotificationPrefs = { order_updates: boolean; agent_messages: boolean; payment_reminders: boolean; offers: boolean };
export type Bank = { code: string; name: string };
export type PayoutAccount = { bank_code: string; bank_name: string; account_number: string; account_name: string };
export type PayoutSummary = {
  earned: string;
  available: string;
  in_review: string;
  withdrawn: string;
  min_withdrawal: number;
  max_per_withdrawal: string;
  daily_limit: string;
  can_withdraw_now: string;
  account: PayoutAccount | null;
};
export type Payout = { id: string; amount: string; status: 'pending_review' | 'processing' | 'paid' | 'failed' | 'rejected' | string; bank_name: string; account_number: string; account_name: string; hold_reason: string | null; created_at: string; paid_at: string | null };
export type Hub = { id: string; market_id: string; name: string; is_active: boolean };

export const api = {
  uploadImage,
  // `identifier` is a phone number (+234…) or an email; the backend tells them apart.
  requestOtp: (identifier: string, channel?: OtpChannel) => request<OtpSent>('/auth/request-otp', { method: 'POST', body: { identifier, ...(channel ? { channel } : {}) } }),
  // `role` is only honoured by a non-production backend, and only for an identifier that has no account yet.
  verifyOtp: (identifier: string, code: string, extra: { full_name?: string; role?: Role } = {}) =>
    request<{ access_token: string }>('/auth/verify-otp', { method: 'POST', body: { identifier, code, ...extra } }),
  me: () => request<ServerUser>('/auth/me'),
  updateProfile: (body: { full_name?: string; default_delivery_address?: string | null; default_delivery_landmark?: string | null; default_delivery_latitude?: number | null; default_delivery_longitude?: number | null }) => request<ServerUser>('/auth/me', { method: 'PATCH', body }),
  health: () => request<{ status: string }>('/health'),

  // --- Catalogue ---
  getMarkets: () => request<ServerMarket[]>('/markets'),
  getPricing: () => request<Pricing>('/pricing'),

  // --- A customer's orders ---
  myCustomerOrders: () => request<AgentOrder[]>('/orders/mine-customer'),
  getOrder: (id: string) => request<AgentOrder>(`/orders/${id}`),
  createOrder: (body: NewOrderBody) => request<AgentOrder>('/orders', { method: 'POST', body }),
  cancelOrder: (id: string) => request<AgentOrder>(`/orders/${id}/cancel`, { method: 'POST' }),
  getProposedAgent: (id: string) => request<ProposedAgent>(`/orders/${id}/proposed-agent`),
  getOrderAgent: (id: string) => request<ProposedAgent>(`/orders/${id}/agent`),
  acceptAgent: (id: string) => request<AgentOrder>(`/orders/${id}/accept-agent`, { method: 'POST' }),
  seeAnotherAgent: (id: string) => request<unknown>(`/orders/${id}/see-another-agent`, { method: 'POST' }),
  decideItem: (id: string, itemId: string, decision: 'buy_elsewhere' | 'dropped') => request<unknown>(`/orders/${id}/items/${itemId}/decide`, { method: 'POST', body: { decision } }),
  decideOverage: (id: string, itemId: string, decision: 'approved' | 'declined') => request<unknown>(`/orders/${id}/items/${itemId}/overage-decide`, { method: 'POST', body: { decision } }),
  confirmDelivery: (id: string) => request<unknown>(`/delivery/orders/${id}/confirm-delivery`, { method: 'POST' }),
  rateAgent: (id: string, stars: number, comment: string | null) => request<unknown>(`/orders/${id}/rating`, { method: 'POST', body: { stars, comment } }),
  getRating: (id: string) => request<{ stars: number; comment: string | null } | null>(`/orders/${id}/rating`),
  // The spending cap the customer has approved, and what has been spent against it.
  getAuthorization: (id: string) => request<{ cap: string; spent: string }>(`/jit/orders/${id}/authorization`),
  raiseCap: (id: string, extra: number) => request<{ cap: string; spent: string }>(`/jit/orders/${id}/authorization/raise`, { method: 'POST', body: { extra: String(extra) } }),
  // Each stall payment, with the photo the agent took.
  getPurchases: (id: string) => request<(Purchase & { status: string })[]>(`/jit/orders/${id}/purchases`),

  // --- The agent's work ---
  myAgentOrders: () => request<AgentOrder[]>('/orders/mine'),
  agentSummary: () => request<AgentSummary>('/agent/summary'),
  agentMe: () => request<{ on_duty: boolean; is_available: boolean; assigned_market_id: string | null }>('/markets/agents/me'),
  // Pause or resume new assignments (never touches an order already in progress).
  setAvailability: (isAvailable: boolean) => request<AgentSummary>('/agent/availability', { method: 'PATCH', body: { is_available: isAvailable } }),
  // Duty is the switch between the agent view (on) and the customer view (off); refused while an order is live.
  setDuty: (onDuty: boolean) => request<{ on_duty: boolean }>('/markets/agents/me/duty', { method: 'PATCH', body: { on_duty: onDuty } }),
  startShopping: (id: string) => request<AgentOrder>(`/orders/${id}/start-shopping`, { method: 'POST' }),
  releaseOrder: (id: string) => request<unknown>(`/orders/${id}/release`, { method: 'POST' }),
  finishShopping: (id: string) => request<AgentOrder>(`/orders/${id}/finish-shopping`, { method: 'POST' }),
  flagUnavailable: (id: string, itemId: string) => request<unknown>(`/orders/${id}/items/${itemId}/unavailable`, { method: 'POST' }),
  requestOverage: (id: string, itemId: string, price: number) => request<unknown>(`/orders/${id}/items/${itemId}/request-overage`, { method: 'POST', body: { price: price.toFixed(2) } }),
  // Pays a stall from the company's float. The amount is the sum of the item prices, and the server enforces the customer's cap.
  payVendor: (id: string, body: { account_number: string; bank_code: string; items: { item_id: string; price: string }[]; seller_id?: string; photo_ref?: string }) =>
    request<unknown>(`/jit/orders/${id}/pay-vendor`, { method: 'POST', body }),
  getVendors: (marketId: string) => request<Vendor[]>(`/markets/${marketId}/vendors`),
  createVendor: (marketId: string, body: { name: string; stall_description?: string }) => request<Vendor>(`/markets/${marketId}/vendors`, { method: 'POST', body }),
  getHubs: (marketId: string) => request<Hub[]>(`/hubs?market_id=${marketId}`),
  dropAtHub: (id: string, hubId?: string) => request<unknown>(`/delivery/orders/${id}/drop-at-hub`, { method: 'POST', body: hubId ? { hub_id: hubId } : {} }),
  addPackingPhotos: (id: string, refs: string[]) => request<unknown>(`/delivery/orders/${id}/packing-photos`, { method: 'POST', body: { refs } }),

  // --- The hub (a shopkeeper's side): goods dropped by agents, checked in, and handed to riders ---
  getMyHub: () => request<Hub>('/hubs/me'),
  getHubOrders: () => request<HubOrder[]>('/hubs/orders'),
  // `received_item_ids` are the items seen in the bag; anything bought but not listed is recorded as missing and needs a note.
  receiveHubOrder: (id: string, body: { received_item_ids: string[]; note?: string; photos?: string[] }) => request<HubOrder>(`/hubs/orders/${id}/receive`, { method: 'POST', body }),
  markHubOrderReady: (id: string) => request<HubOrder>(`/hubs/orders/${id}/ready`, { method: 'POST' }),
  handoverHubOrder: (id: string, code: string) => request<HubOrder>(`/hubs/orders/${id}/handover`, { method: 'POST', body: { code } }),
  searchPlaces: (q: string, session: string) => request<PlaceSuggestion[]>(`/locations/search?q=${encodeURIComponent(q)}&session=${session}`),
  getPlace: (placeId: string, session: string) => request<PlaceDetails>(`/locations/place?place_id=${encodeURIComponent(placeId)}&session=${session}`),
  notifications: () => request<AppNotification[]>('/notifications'),
  markNotificationRead: (id: string) => request<AppNotification>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request<unknown>('/notifications/read-all', { method: 'POST' }),
  notificationPrefs: () => request<NotificationPrefs>('/auth/me/notification-preferences'),
  setNotificationPrefs: (body: Partial<NotificationPrefs>) => request<NotificationPrefs>('/auth/me/notification-preferences', { method: 'PATCH', body }),
  payoutBanks: () => request<Bank[]>('/payouts/banks'),
  payoutSummary: () => request<PayoutSummary>('/payouts/summary'),
  savePayoutAccount: (bank_code: string, account_number: string) => request<PayoutAccount>('/payouts/account', { method: 'PUT', body: { bank_code, account_number } }),
  withdraw: (amount: number) => request<Payout>('/payouts', { method: 'POST', body: { amount: String(amount) } }),
  myPayouts: () => request<Payout[]>('/payouts'),
  getHubEarnings: () => request<Earnings>('/hubs/earnings'),

  // --- The rider: claim a ready order, collect it from the hub, deliver it with the customer's code ---
  getRiderJobs: () => request<RiderJob[]>('/riders/jobs'),
  getMyRiderJobs: () => request<RiderJob[]>('/riders/jobs/mine'),
  claimRiderJob: (id: string) => request<RiderJob>(`/riders/jobs/${id}/claim`, { method: 'POST' }),
  releaseRiderJob: (id: string) => request<unknown>(`/riders/jobs/${id}/release`, { method: 'POST' }),
  deliverRiderJob: (id: string, code: string) => request<RiderJob>(`/riders/jobs/${id}/deliver`, { method: 'POST', body: { code } }),
  getRiderEarnings: () => request<Earnings>('/riders/earnings'),

  // --- Chat: the private line between a customer and their agent ---
  getConversations: () => request<Conversation[]>('/chat/conversations'),
  getMessages: (orderId: string) => request<Message[]>(`/orders/${orderId}/messages`),
  sendMessage: (orderId: string, body: { text?: string; image_url?: string }) => request<Message>(`/orders/${orderId}/messages`, { method: 'POST', body }),
  markChatRead: (orderId: string) => request<null>(`/orders/${orderId}/messages/read`, { method: 'POST' }),

  // --- Wallet and paying (the dev wallet top-up only exists on a non-production server) ---
  getWallet: () => request<{ balance: string }>('/wallet'),
  getWalletTransactions: () => request<WalletEntry[]>('/wallet/transactions'),
  // Card top-up through Paystack: opens a payment page. The wallet is credited once Paystack confirms, which the app asks for
  // after the customer comes back (verifyWalletFunding), because the server can't be told directly while it's on a laptop.
  fundWalletInit: (amount: number) => request<{ authorization_url: string; reference: string }>('/payments/wallet/fund/init', { method: 'POST', body: { amount: String(amount) } }),
  verifyWalletFunding: (reference: string) => request<{ balance: string; verified: boolean }>('/payments/wallet/fund/verify', { method: 'POST', body: { reference } }),
  fundWalletDev: (amount: number) => request<{ balance: string }>('/wallet/fund', { method: 'POST', body: { amount: String(amount) } }),
  // These answer with a short receipt ({ paid, status }), not the order: reload the order afterwards.
  payDeposit: (id: string) => request<{ paid: string; status: string }>(`/payments/orders/${id}/deposit/pay-from-wallet`, { method: 'POST' }),
  payBalance: (id: string) => request<{ paid: string; status: string }>(`/payments/orders/${id}/pay-from-wallet`, { method: 'POST' }),
};
