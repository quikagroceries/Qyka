export type Role = 'customer' | 'agent' | 'rider' | 'shopkeeper' | 'admin';

export type User = {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  role: Role;
  status: string;
  default_delivery_address?: string | null;
  default_delivery_landmark?: string | null;
  default_delivery_latitude?: number | null;
  default_delivery_longitude?: number | null;
  avatar_url?: string | null;
  must_prepay?: boolean;
  /** False for agent-only accounts: there is no customer view to switch to. */
  has_customer_side?: boolean;
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
  delivery_landmark?: string | null;
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

export type HubItem = {
  id: string;
  description: string;
  quantity: number | null;
  requested_note: string | null;
  /** 'unavailable' or 'dropped' means it was never bought, so the hub shouldn't expect it in the bag. */
  availability?: string;
};

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
  /** When the balance has to be paid by, or the order is cancelled and the deposit is lost. */
  payment_window_expires_at?: string | null;
  proposed_agent_id?: string | null;
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
  latitude?: number | null;
  longitude?: number | null;
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

export type Application = {
  id: string;
  kind: 'agent' | 'rider' | 'shopkeeper';
  status: 'pending' | 'approved' | 'rejected';
  market_id: string | null;
  created_at: string;
  note: string | null;
};
