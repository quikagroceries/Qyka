// Static sample data so every screen has something to show. UI only: nothing
// here is fetched, saved or validated.
import type { AgentOrder, Conversation, Earnings, HubOrder, Market, Message, OrderItem, Person, Purchase, RiderJob, Role, User } from '@/lib/types';

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const USERS: Record<Role, User> = {
  customer: { id: 'u-customer', phone: '08012345678', email: null, full_name: 'Ada Okafor', role: 'customer', status: 'active', default_delivery_address: '12 Adeola Odeku St, Victoria Island' },
  agent: { id: 'u-agent', phone: '08023456789', email: null, full_name: 'Tunde Bakare', role: 'agent', status: 'active' },
  rider: { id: 'u-rider', phone: '08034567890', email: null, full_name: 'Musa Ibrahim', role: 'rider', status: 'active' },
  shopkeeper: { id: 'u-shop', phone: '08045678901', email: null, full_name: 'Ngozi Eze', role: 'shopkeeper', status: 'active' },
  admin: { id: 'u-admin', phone: null, email: 'admin@qyka.test', full_name: 'Admin', role: 'admin', status: 'active' },
};

export const GUEST: User = { id: 'u-guest', phone: null, email: null, full_name: null, role: 'customer', status: 'guest' };

export const MARKETS: Market[] = [
  { id: 'm-1', name: 'Mile 12 Market', city: 'Lagos', state: 'Lagos', description: 'Fresh produce, grains and provisions.' },
  { id: 'm-2', name: 'Oyingbo Market', city: 'Lagos', state: 'Lagos', description: 'Fish, meat and everyday groceries.' },
  { id: 'm-3', name: 'Ketu Market', city: 'Lagos', state: 'Lagos', description: 'Vegetables and spices.' },
];
export const marketName = (id: string) => MARKETS.find((m) => m.id === id)?.name;

export const PRICING = { serviceFeeRate: 0.075, deliveryFee: 1500, depositRate: 0.3 };
export const WALLET_BALANCE = '5000.00';

export const PEOPLE: Record<string, Person> = {
  agent: { id: 'u-agent', full_name: 'Tunde Bakare', avatar_url: null, phone: '08023456789' },
  customer: { id: 'u-customer', full_name: 'Ada Okafor', avatar_url: null },
};

const item = (id: string, description: string, over: Partial<OrderItem> = {}): OrderItem => ({
  id,
  description,
  requested_note: null,
  listed_price: null,
  quantity: null,
  preferred_stall_id: null,
  availability: 'available',
  confirmed_price: null,
  vendor_transfer_id: null,
  overage_requested_price: null,
  overage_decision: null,
  ...over,
});

const order = (id: string, status: string, items: OrderItem[], over: Partial<AgentOrder> = {}): AgentOrder => ({
  id,
  status,
  market_id: 'm-1',
  items,
  packing_photos: null,
  dropped_at_hub_at: null,
  agent_id: 'u-agent',
  items_total: '0.00',
  combined_fee: '0.00',
  delivery_fee: '0.00',
  delivery_quote: '1500.00',
  emtl_total: '0.00',
  transfer_fees_total: '0.00',
  grand_total: '0.00',
  goods_estimate: '8000.00',
  deposit_amount: '2400.00',
  deposit_paid_at: minsAgo(200),
  created_at: minsAgo(240),
  agent_assigned_at: minsAgo(220),
  paid_at: null,
  hub_id: 'h-1',
  hub_received_at: null,
  packed_at: null,
  rider_claimed_at: null,
  rider_delivered_at: null,
  dispatched_at: null,
  delivered_at: null,
  handover_code: null,
  delivery_address: '12 Adeola Odeku St, Victoria Island',
  ...over,
});

export const ORDERS: AgentOrder[] = [
  order('a1b2c3d4-0001', 'shopping', [
    item('i1', 'Tomatoes (big basket)', { quantity: 1, listed_price: '3000.00', confirmed_price: '2800.00' }),
    item('i2', 'Pepper (tatashe)', { quantity: 2, listed_price: '1000.00', availability: 'overage_pending', overage_requested_price: '1500.00' }),
    item('i3', 'Onions', { quantity: 3, listed_price: '1500.00', availability: 'unavailable' }),
    item('i4', 'Plantain bunch', { listed_price: '2500.00' }),
  ], { created_at: minsAgo(90) }),
  order('a1b2c3d4-0002', 'awaiting_payment', [
    item('i5', 'Rice (50kg bag)', { confirmed_price: '68000.00', listed_price: '70000.00' }),
    item('i6', 'Groundnut oil (5L)', { confirmed_price: '12500.00' }),
  ], { items_total: '80500.00', combined_fee: '6037.50', delivery_fee: '1500.00', grand_total: '88037.50', deposit_amount: '24000.00', created_at: minsAgo(300) }),
  order('a1b2c3d4-0003', 'proposed', [item('i7', 'Fresh fish (catfish)', { quantity: 2 }), item('i8', 'Crayfish')], { agent_id: null, agent_assigned_at: null, deposit_paid_at: null, created_at: minsAgo(15) }),
  order('a1b2c3d4-0004', 'out_for_delivery', [
    item('i9', 'Yam tubers', { confirmed_price: '6000.00' }),
    item('i10', 'Eggs (crate)', { confirmed_price: '3800.00' }),
  ], {
    items_total: '9800.00', combined_fee: '735.00', delivery_fee: '1500.00', grand_total: '12035.00', deposit_amount: '3000.00',
    paid_at: minsAgo(150), dropped_at_hub_at: minsAgo(120), hub_received_at: minsAgo(110), packed_at: minsAgo(100),
    rider_claimed_at: minsAgo(60), dispatched_at: minsAgo(45), handover_code: '4821', created_at: minsAgo(400),
  }),
  order('a1b2c3d4-0005', 'delivered', [item('i11', 'Garri (paint bucket)', { confirmed_price: '2500.00' })], {
    items_total: '2500.00', combined_fee: '187.50', delivery_fee: '1500.00', grand_total: '4187.50', deposit_amount: '0.00', deposit_paid_at: null,
    paid_at: minsAgo(2000), dropped_at_hub_at: minsAgo(1950), hub_received_at: minsAgo(1940), packed_at: minsAgo(1930), rider_claimed_at: minsAgo(1900), dispatched_at: minsAgo(1890), delivered_at: minsAgo(1850), created_at: minsAgo(2200),
  }),
  order('a1b2c3d4-0006', 'agent_assigned', [item('i12', 'Bitter leaf'), item('i13', 'Ugwu leaves', { quantity: 2 })], { created_at: minsAgo(30) }),
  order('a1b2c3d4-0007', 'paid', [item('i14', 'Beans (brown)', { confirmed_price: '4500.00' })], { items_total: '4500.00', paid_at: minsAgo(20), created_at: minsAgo(180) }),
];
/** Builds the order a customer just placed. The order store adds it, so Track and the order page can show it. */
export function placeOrder(input: { marketId: string; address: string; goodsEstimate: number; depositAmount: number; items: { description: string; quantity?: number; price?: number }[] }): AgentOrder {
  const id = `a1b2c3d4-${Date.now()}`;
  const placed = order(
    id,
    'proposed',
    input.items.map((it, i) =>
      item(`n${i}`, it.description, { quantity: it.quantity ?? 1, listed_price: it.price ? it.price.toFixed(2) : null }),
    ),
    {
      market_id: input.marketId,
      agent_id: null,
      agent_assigned_at: null,
      deposit_paid_at: null,
      delivery_address: input.address,
      goods_estimate: input.goodsEstimate.toFixed(2),
      deposit_amount: input.depositAmount.toFixed(2),
      created_at: new Date().toISOString(),
    },
  );
  return placed;
}
export const orderById = (id?: string) => ORDERS.find((o) => o.id === id) ?? ORDERS[0];

export const PURCHASES: Purchase[] = [
  { id: 'p1', amount: '2800.00', account_number: '0123456789', photo_ref: null },
];

export const HUB_ORDERS: HubOrder[] = [
  {
    id: 'b1c2d3e4-0004', customer_order_id: 'a1b2c3d4-0006', status: 'paid', agent_name: 'Chidi Obi', rider_name: null, rider_waiting: false,
    items: [{ id: 'h7', description: 'Garri (paint bucket)', quantity: 2, requested_note: null }, { id: 'h8', description: 'Groundnut oil (5L)', quantity: 1, requested_note: null }],
    packing_photos: [], dropped_at_hub_at: null, hub_received_at: null, hub_missing_item_ids: [], hub_receipt_note: null,
  },
  {
    id: 'b1c2d3e4-0001', customer_order_id: 'a1b2c3d4-0001', status: 'dropped_at_hub', agent_name: 'Tunde Bakare', rider_name: null, rider_waiting: false,
    items: [
      { id: 'h1', description: 'Tomatoes (big basket)', quantity: 1, requested_note: null },
      { id: 'h2', description: 'Pepper (tatashe)', quantity: 2, requested_note: 'Not too ripe' },
      { id: 'h3', description: 'Onions', quantity: 3, requested_note: null },
      { id: 'h9', description: 'Okra', quantity: 1, requested_note: 'Customer skipped this', availability: 'dropped' },
    ],
    packing_photos: [], dropped_at_hub_at: minsAgo(8), hub_received_at: null, hub_missing_item_ids: [], hub_receipt_note: null,
  },
  {
    id: 'b1c2d3e4-0002', customer_order_id: 'a1b2c3d4-0002', status: 'received_by_hub', agent_name: 'Chidi Obi', rider_name: null, rider_waiting: false,
    items: [{ id: 'h4', description: 'Yam tubers', quantity: 2, requested_note: null }, { id: 'h5', description: 'Eggs (crate)', quantity: 1, requested_note: null }],
    packing_photos: [], dropped_at_hub_at: minsAgo(40), hub_received_at: minsAgo(30), hub_missing_item_ids: ['h5'], hub_receipt_note: 'Eggs were not in the bag.',
  },
  {
    id: 'b1c2d3e4-0003', customer_order_id: 'a1b2c3d4-0007', status: 'ready_for_pickup', agent_name: 'Tunde Bakare', rider_name: 'Musa Ibrahim', rider_waiting: true, rider_code: '7305', ready_at: minsAgo(80),
    items: [{ id: 'h6', description: 'Rice (50kg bag)', quantity: 1, requested_note: null }],
    packing_photos: [], dropped_at_hub_at: minsAgo(90), hub_received_at: minsAgo(80), hub_missing_item_ids: [], hub_receipt_note: null,
  },
];
export const hubOrderById = (id?: string) => HUB_ORDERS.find((o) => o.id === id) ?? HUB_ORDERS[0];

const job = (id: string, over: Partial<RiderJob> = {}): RiderJob => ({
  id, status: 'ready_for_pickup', hub_id: 'h-1', hub_name: 'Mile 12 Hub', market_name: 'Mile 12 Market', item_count: 4,
  ready_at: minsAgo(12), claimed_at: null, pickup_code: null, customer_name: null, customer_phone: null, delivery_address: null,
  dropoff_latitude: null, dropoff_longitude: null, delivered_at: null, ...over,
});
export const RIDER_POOL: RiderJob[] = [job('c1d2e3f4-0001'), job('c1d2e3f4-0002', { item_count: 2, hub_name: 'Oyingbo Hub', market_name: 'Oyingbo Market', ready_at: minsAgo(3) })];
export const RIDER_ACTIVE: RiderJob = job('c1d2e3f4-0009', {
  status: 'out_for_delivery', claimed_at: minsAgo(30), pickup_code: '7305', customer_name: 'Ada Okafor', customer_phone: '08012345678',
  delivery_address: '12 Adeola Odeku St, Victoria Island', dropoff_latitude: 6.4281, dropoff_longitude: 3.4219,
});

export const EARNINGS: Earnings = {
  earnings_today: '3000.00',
  earnings_week: '14500.00',
  earnings_total: '86500.00',
  completed_count: 29,
  recent: [
    { order_id: 'c1d2e3f4-0101', amount: '1500.00', delivered_at: minsAgo(90) },
    { order_id: 'c1d2e3f4-0102', amount: '1500.00', delivered_at: minsAgo(260) },
    { order_id: 'c1d2e3f4-0103', amount: '1500.00', delivered_at: minsAgo(1500) },
  ],
};

export const CONVERSATIONS: Conversation[] = [
  { order_id: ORDERS[0].id, order_status: 'shopping', market_name: 'Mile 12 Market', other: { id: 'u-agent', full_name: 'Tunde Bakare', avatar_url: null },
    last_message: { text: 'The pepper is a bit pricey today, ok to go higher?', has_image: false, sender_id: 'u-agent', created_at: minsAgo(4) }, unread: 2 },
  { order_id: ORDERS[5].id, order_status: 'agent_assigned', market_name: 'Mile 12 Market', other: { id: 'u-agent', full_name: 'Tunde Bakare', avatar_url: null },
    last_message: { text: 'Starting shortly', has_image: false, sender_id: 'u-agent', created_at: minsAgo(60) }, unread: 0 },
];

export const MESSAGES: Message[] = [
  { id: 'm1', order_id: ORDERS[0].id, sender_id: 'u-customer', text: 'Market list\n1. Tomatoes\n2. Pepper ×2\n3. Onions ×3', image_url: null, created_at: minsAgo(80) },
  { id: 'm2', order_id: ORDERS[0].id, sender_id: 'u-agent', text: 'On it, heading to the stalls now.', image_url: null, created_at: minsAgo(70) },
  { id: 'm3', order_id: ORDERS[0].id, sender_id: 'u-agent', text: 'The pepper is a bit pricey today, ok to go higher?', image_url: null, created_at: minsAgo(4) },
];

/** Extra profile details for the sample agent (UI only; a real profile would come from the backend). */
export const AGENT_PROFILE = {
  rating: 4.9,
  reviews: 126,
  ordersDone: 312,
  since: 'Mar 2025',
  markets: ['Mile 12 Market', 'Oyingbo Market'],
  review: { quote: 'Sent photos of every item before paying and got me a better price on the tomatoes. Will order again.', by: 'Chioma, Lekki' },
};

/** Sample customer reviews and the star breakdown for the sample agent (UI only). */
export const AGENT_REVIEWS = [
  { id: 'r1', by: 'Chioma, Lekki', stars: 5, text: 'Sent photos of every item before paying and got me a better price on the tomatoes. Will order again.', when: '2 days ago' },
  { id: 'r2', by: 'Emeka, Yaba', stars: 5, text: 'Fast and polite. Everything was fresh and exactly what I asked for.', when: '5 days ago' },
  { id: 'r3', by: 'Funke, Surulere', stars: 4, text: 'Good job overall. The pepper was a bit pricey but he checked with me first.', when: '1 week ago' },
  { id: 'r4', by: 'Tosin, Ikeja', stars: 5, text: 'Kept me updated the whole time in chat. Very easy to deal with.', when: '2 weeks ago' },
  { id: 'r5', by: 'Aisha, Ajah', stars: 5, text: 'Found the last bag of rice at a different stall when the first had none. Legend.', when: '3 weeks ago' },
  { id: 'r6', by: 'Bode, Maryland', stars: 3, text: 'Took a little longer than expected but the goods were good.', when: '1 month ago' },
];
export const REVIEW_BREAKDOWN: Record<number, number> = { 5: 104, 4: 15, 3: 4, 2: 2, 1: 1 };

/** Sample money for the earnings screens (UI only). Earned money is paid out to this bank account. */
export const PAYOUT = {
  available: 14500,
  pending: 4500,
  bank: { name: 'GTBank', last4: '4821', holder: 'Tunde Bakare' },
};
