import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import PaymentChooser from '@/components/customer/PaymentChooser';
import { Avatar, Button, Card, ErrorBanner, Field, Hero, ItemArt, SafeAreaView, SectionHeader, StatusBadge } from '@/components/ui';
import { api, type AgentOrder, type Market, type OrderItem, type Person, type Purchase } from '@/lib/api';
import { errMsg, naira, shortId } from '@/lib/format';
import { openCheckout } from '@/lib/paystack';
import { CHAT, EXCEPTION, ON_THE_MOVE, PAID_OR_LATER, RATEABLE, UNPRICED, summarize } from '@/lib/orderStatus';
import { usePolling } from '@/lib/usePolling';

// Statuses move every few minutes, so a slow poll is plenty, except while the
// order is being shopped and the agent may be waiting on an approval.
const POLL_MS = 25000;
const POLL_MS_SHOPPING = 8000;

const art = {
  shopping: require('../../../../../assets/illustrations/agent-customer-conversation.webp'),
  moving: require('../../../../../assets/illustrations/rider-scooter-basket-1.webp'),
  done: require('../../../../../assets/illustrations/order-handoff-vendor-customer.webp'),
  default: require('../../../../../assets/illustrations/market-cart-vendor.webp'),
};

// The timeline is built from the order's own timestamps, so it never claims a
// step the system hasn't recorded. Orders from before hubs existed keep the
// older packed/courier timeline.
type Row = { key: string; label: string; ts: (o: AgentOrder) => string | null };
const ROWS: Row[] = [
  { key: 'placed', label: 'Order placed', ts: (o) => o.created_at },
  { key: 'agent', label: 'Agent assigned & accepted', ts: (o) => o.agent_assigned_at },
  { key: 'paid', label: 'Balance paid', ts: (o) => o.paid_at },
  { key: 'at_hub', label: 'Dropped at the market hub', ts: (o) => o.dropped_at_hub_at },
  { key: 'checked_in', label: 'Checked in at the hub', ts: (o) => o.hub_received_at },
  { key: 'ready', label: 'Ready for a rider', ts: (o) => o.packed_at },
  { key: 'rider', label: 'Rider assigned', ts: (o) => o.rider_claimed_at },
  { key: 'out', label: 'Out for delivery', ts: (o) => o.dispatched_at },
  { key: 'delivered', label: 'Delivered', ts: (o) => o.delivered_at },
];
const LEGACY_ROWS: Row[] = [
  { key: 'placed', label: 'Order placed', ts: (o) => o.created_at },
  { key: 'agent', label: 'Agent assigned & accepted', ts: (o) => o.agent_assigned_at },
  { key: 'paid', label: 'Balance paid', ts: (o) => o.paid_at },
  { key: 'packed', label: 'Packed', ts: (o) => o.packed_at },
  { key: 'out', label: 'Out for delivery', ts: (o) => o.dispatched_at },
  { key: 'delivered', label: 'Delivered', ts: (o) => o.delivered_at },
];

const stamp = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const CURRENT_NOTE: Record<string, string> = {
  at_hub: 'Your agent is taking your order to the hub in the market.',
  checked_in: 'The hub is checking everything arrived.',
  ready: 'Being bagged up for your rider.',
  rider: 'Waiting for a rider to pick up your order.',
};

function Timeline({ order, onPreview }: { order: AgentOrder; onPreview: (u: string) => void }) {
  const legacy = !order.hub_id && (order.status === 'packed' || !!order.dispatched_at || !!order.delivered_at);
  const rows = legacy ? LEGACY_ROWS : ROWS;
  const current = rows.findIndex((r) => !r.ts(order));
  const photos = order.packing_photos || [];
  return (
    <View>
      {rows.map((r, i) => {
        const t = r.ts(order);
        const done = !!t;
        const isCurrent = i === current;
        const last = i === rows.length - 1;
        return (
          <View key={r.key} className="flex-row gap-3">
            <View className="items-center">
              <View className={'h-8 w-8 items-center justify-center rounded-full ' + (done ? 'bg-brand-green' : isCurrent ? 'bg-brand-orange' : 'bg-sunken')}>
                {done ? <Text className="font-extrabold text-white">✓</Text> : <View className="h-2 w-2 rounded-full bg-faint" />}
              </View>
              {!last ? <View className={'my-1 w-0.5 flex-1 ' + (done ? 'bg-brand-green' : 'bg-line-strong')} /> : null}
            </View>
            <View className={'flex-1 ' + (last ? '' : 'pb-5')}>
              <View className="flex-row flex-wrap items-center justify-between gap-x-2">
                <Text className={'font-semibold ' + (done || isCurrent ? 'text-ink' : 'text-faint')}>{r.label}</Text>
                {done ? <Text className="text-xs text-faint">{stamp(t!)}</Text> : null}
                {isCurrent ? (
                  <Text className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-bold text-brand-orange-dark">In progress</Text>
                ) : null}
              </View>
              {isCurrent && CURRENT_NOTE[r.key] ? <Text className="mt-1 text-sm text-faint">{CURRENT_NOTE[r.key]}</Text> : null}
              {(r.key === 'at_hub' || r.key === 'packed') && done && photos.length > 0 ? (
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {photos.map((u, k) => (
                    <Pressable key={u + k} onPress={() => onPreview(u)}>
                      <Image source={{ uri: u }} className="h-16 w-16 rounded-lg" />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ItemLine({ item, purchase, busy, onDecide, onPreview }: { item: OrderItem; purchase?: Purchase; busy: boolean; onDecide: (d: 'buy_elsewhere' | 'dropped') => void; onPreview: (u: string) => void }) {
  const bought = item.confirmed_price != null;
  const dropped = item.availability === 'dropped';
  const unavailable = !bought && item.availability === 'unavailable';
  const elsewhere = !bought && item.availability === 'buy_elsewhere';
  const overagePending = !bought && item.availability === 'overage_pending';
  return (
    <View className="gap-2 border-t border-dashed border-line-strong py-3">
      <View className="flex-row items-center gap-3">
        <View className={'h-7 w-7 items-center justify-center rounded-full ' + (bought ? 'bg-brand-green/10' : 'bg-sunken')}>
          {bought ? <Text className="font-extrabold text-brand-green">✓</Text> : null}
        </View>
        <ItemArt name={item.description} />
        <View className="flex-1">
          <Text className={'font-semibold ' + (bought || dropped ? 'text-faint ' : 'text-ink ') + (dropped ? 'line-through' : '')}>
            {item.quantity ? `${item.quantity} × ` : ''}
            {item.description}
          </Text>
          {bought ? (
            <Text className="text-sm text-brand-green">
              Bought for {naira(item.confirmed_price!)}
              {item.listed_price != null && Number(item.confirmed_price) < Number(item.listed_price) ? ` (saved ${naira(Number(item.listed_price) - Number(item.confirmed_price))})` : ''}
            </Text>
          ) : null}
          {dropped ? <Text className="text-sm text-faint">You skipped this item</Text> : null}
          {elsewhere ? <Text className="text-sm text-muted">Agent will look at another stall</Text> : null}
          {overagePending ? <Text className="text-sm font-semibold text-amber-700">Waiting for your approval of {naira(item.overage_requested_price ?? 0)}</Text> : null}
        </View>
        {purchase?.photo_ref ? (
          <Pressable onPress={() => onPreview(purchase.photo_ref!)}>
            <Image source={{ uri: purchase.photo_ref }} className="h-10 w-10 rounded-lg" />
          </Pressable>
        ) : null}
      </View>
      {unavailable ? (
        <View className="gap-2 rounded-2xl bg-brand-orange/[0.12] p-3">
          <Text className="text-sm font-semibold text-ink">Your agent couldn&apos;t find this at the stall. What now?</Text>
          <View className="flex-row gap-2">
            <Button label="Try another stall" busy={busy} className="flex-1" onPress={() => onDecide('buy_elsewhere')} />
            <Button label="Skip it" variant="neutral" busy={busy} className="flex-1" onPress={() => onDecide('dropped')} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function CustomerOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<AgentOrder | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [agent, setAgent] = useState<Person | null>(null);
  const [proposed, setProposed] = useState<Person | null>(null);
  const [notice, setNotice] = useState('');
  const [auth, setAuth] = useState<{ cap: string; spent: string } | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);
  const [rating, setRating] = useState<{ stars: number; comment: string | null } | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [raise, setRaise] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);
  const agentIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const o = await api.order(id);
      setOrder(o);
      loaded.current = true;
      setError(null);
      if (o.status === 'shopping') api.authorization(id).then(setAuth).catch(() => setAuth(null));
      if (o.status === 'shopping' || o.status === 'awaiting_payment' || PAID_OR_LATER.has(o.status)) api.purchases(id).then(setPurchases).catch(() => {});
      if (o.status === 'proposed') api.proposedAgent(id).then(setProposed).catch(() => setProposed(null));
      // The assigned agent is fetched once per agent, not on every poll.
      if (o.agent_id && agentIdRef.current !== o.agent_id) {
        agentIdRef.current = o.agent_id;
        api.orderAgent(id).then(setAgent).catch(() => {});
      }
      if (RATEABLE.has(o.status)) api.rating(id).then(setRating).catch(() => setRating(null));
      api.walletBalance().then((w) => setWallet(w.balance)).catch(() => {});
    } catch {
      if (!loaded.current) setError('Could not load the order.');
    }
  }, [id]);
  usePolling(refresh, order?.status === 'shopping' ? POLL_MS_SHOPPING : POLL_MS);

  const marketId = order?.market_id;
  useEffect(() => {
    if (marketId) api.markets().then((l) => setMarket(l.find((m) => m.id === marketId) || null)).catch(() => {});
  }, [marketId]);

  async function act(fn: () => Promise<unknown>, failPrefix: string, after?: () => void | Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await after?.();
      await refresh();
    } catch (e) {
      setError(`${failPrefix}: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // Bank transfer: open Paystack, then verify with the reference we hold.
  const payByTransfer = (kind: 'deposit' | 'balance') =>
    act(
      async () => {
        const c = kind === 'deposit' ? await api.checkoutDeposit(id) : await api.checkoutBalance(id);
        await openCheckout(c.authorization_url);
        await (kind === 'deposit' ? api.verifyDeposit(id, c.reference) : api.verifyBalance(id, c.reference));
      },
      'Payment not confirmed yet. If you were charged, this will update shortly',
    );

  const topUp = () =>
    act(async () => {
      const c = await api.fundWallet(String(Math.max(1000, Math.ceil(amountDue - Number(wallet || 0)))));
      await openCheckout(c.authorization_url);
      await api.verifyFunding(c.reference);
    }, 'Top-up not confirmed yet');

  if (!order) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View className="gap-3 p-4">
          <Pressable onPress={() => router.replace('/customer')}>
            <Text className="text-sm font-semibold text-muted">← Back</Text>
          </Pressable>
          {error ? <ErrorBanner message={error} /> : <Text className="text-muted">Loading order…</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const items = order.items || [];
  const depositPaid = !!order.deposit_paid_at;
  const needsDeposit = Number(order.deposit_amount) > 0 && !depositPaid;
  const priced = !UNPRICED.has(order.status);
  const amountDue = priced ? Math.max(0, Number(order.grand_total) - (depositPaid ? Number(order.deposit_amount) : 0)) : 0;
  const paidOrLater = PAID_OR_LATER.has(order.status);
  const exception = EXCEPTION.has(order.status);
  const showFeed = order.status === 'shopping' || order.status === 'awaiting_payment';
  const overages = items.filter((it) => it.availability === 'overage_pending');
  const canChat = CHAT.has(order.status);
  const riderSaysDelivered = order.status === 'out_for_delivery' && !!order.rider_delivered_at;
  const purchaseFor = (it: OrderItem) => purchases.find((p) => p.id === it.vendor_transfer_id);
  const image = order.status === 'delivered' || order.status === 'closed' ? art.done : ON_THE_MOVE.has(order.status) ? art.moving : showFeed ? art.shopping : art.default;
  const fees = Number(order.combined_fee) + Number(order.emtl_total) + Number(order.transfer_fees_total);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.replace('/customer')} className="self-start py-1">
          <Text className="text-sm font-semibold text-muted">← Back</Text>
        </Pressable>

        <Hero eyebrow={`${market?.name || 'Order'} · #${shortId(order.id)}`} title={summarize(order, market?.name)} image={image}>
          <View className="gap-3">
            <StatusBadge status={order.status} />
            {agent && !exception ? (
              <View className="flex-row items-center gap-2.5 self-start rounded-full border border-line-strong bg-surface py-1 pl-1 pr-4">
                <Avatar uri={agent.avatar_url} name={agent.full_name} className="h-9 w-9" />
                <View>
                  <Text className="text-[10px] font-bold uppercase tracking-wide text-faint">Your agent</Text>
                  <Text className="text-sm font-bold text-ink">{agent.full_name || 'Your agent'}</Text>
                </View>
              </View>
            ) : null}
            {canChat ? <Button label="Chat with agent" onPress={() => router.push(`/customer/chat/${id}`)} /> : null}
          </View>
        </Hero>

        <ErrorBanner message={error} />

        {exception ? (
          <View className="gap-1 rounded-3xl bg-red-50 p-5">
            <Text className="text-xs font-bold uppercase tracking-wide text-red-700">{order.status === 'disputed' ? 'Order under review' : 'Order cancelled'}</Text>
            <Text className="text-ink/80">
              {order.status === 'disputed'
                ? 'Our team is looking into this order. If you have photos or details that could help, send them in chat or reach support.'
                : order.status === 'cancelled_unpaid'
                  ? "This order was cancelled after payment wasn't completed in time."
                  : 'This order was cancelled.'}
            </Text>
          </View>
        ) : (
          <>
            {overages.map((item) => {
              const extra = Number(item.overage_requested_price) - Number(item.listed_price);
              return (
                <View key={item.id} className="gap-2 rounded-3xl bg-brand-orange/[0.12] p-5">
                  <Text className="text-xs font-bold uppercase tracking-wide text-brand-orange-dark">Price approval needed</Text>
                  <Text className="font-semibold text-ink">{item.description}</Text>
                  <Text className="text-sm text-muted">
                    {naira(item.overage_requested_price ?? 0)} at the stall · {naira(extra)} over your {naira(item.listed_price ?? 0)}
                  </Text>
                  <View className="flex-row gap-2">
                    <Button label={`Approve extra ${naira(extra)}`} busy={busy} className="flex-1" onPress={() => void act(() => api.decideOverage(id, item.id, 'approved'), 'Could not record your decision')} />
                    <Button label="Skip this item" variant="neutral" busy={busy} className="flex-1" onPress={() => void act(() => api.decideOverage(id, item.id, 'declined'), 'Could not record your decision')} />
                  </View>
                </View>
              );
            })}

            {needsDeposit ? (
              <View className="gap-3 rounded-3xl bg-brand-orange/[0.12] p-5">
                <Text className="text-xs font-bold uppercase tracking-wide text-brand-orange-dark">Deposit required</Text>
                <Text className="text-sm text-ink/80">
                  {Number(order.goods_estimate) > 0 && Number(order.deposit_amount) / Number(order.goods_estimate) >= 0.99
                    ? "Full payment upfront (a previous order wasn't paid) "
                    : 'A deposit upfront '}
                  {order.status === 'proposed' ? 'before you can see and accept your shopping agent.' : 'before shopping can start.'}
                </Text>
                <PaymentChooser
                  amountDue={Number(order.deposit_amount)}
                  walletBalance={wallet}
                  busy={busy}
                  onPayWallet={() => void act(() => api.payDepositWallet(id), 'Deposit payment failed')}
                  onPayTransfer={() => void payByTransfer('deposit')}
                  onTopUp={() => void topUp()}
                />
              </View>
            ) : null}

            {order.status === 'proposed' && !needsDeposit ? (
              <Card accent>
                <Text className="text-lg font-bold text-ink">Your shopping agent</Text>
                {proposed ? (
                  <View className="flex-row items-center gap-3">
                    <Avatar uri={proposed.avatar_url} name={proposed.full_name} className="h-14 w-14" />
                    <View>
                      <Text className="font-semibold text-ink">{proposed.full_name || 'Unnamed agent'}</Text>
                      <Text className="text-sm text-faint">{proposed.phone}</Text>
                    </View>
                  </View>
                ) : (
                  <Text className="text-sm text-faint">Looking for an available agent…</Text>
                )}
                {notice ? <Text className="rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange-dark">{notice}</Text> : null}
                <View className="flex-row gap-2">
                  <Button label="Accept" busy={busy} disabled={!proposed} className="flex-1" onPress={() => void act(() => api.acceptAgent(id), 'Could not accept this agent', () => { setNotice(''); setProposed(null); })} />
                  <Button
                    label="See another"
                    variant="neutral"
                    busy={busy}
                    disabled={!proposed}
                    className="flex-1"
                    onPress={() =>
                      void act(async () => {
                        const r = await api.seeAnotherAgent(id);
                        setNotice(
                          r.outcome === 'only_option'
                            ? `No other agents available in this market. ${proposed?.full_name || 'This agent'} is your only option.`
                            : r.outcome === 'none'
                              ? 'No agents available for this market right now.'
                              : '',
                        );
                      }, 'Could not look for another agent')
                    }
                  />
                </View>
              </Card>
            ) : null}

            {!paidOrLater && !showFeed ? (
              <>
                <Card>
                  <SectionHeader title={`Your list (${items.length})`} />
                  {items.map((it) => (
                    <View key={it.id} className="flex-row items-center gap-3 border-t border-dashed border-line-strong py-2.5">
                      <ItemArt name={it.description} />
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-ink">{it.quantity ? `${it.quantity} × ` : ''}{it.description}</Text>
                        {it.requested_note ? <Text className="text-xs text-faint">{it.requested_note}</Text> : null}
                      </View>
                    </View>
                  ))}
                </Card>
                <Card>
                  <SectionHeader title="Order estimate" />
                  <View className="flex-row justify-between"><Text className="text-muted">Goods estimate</Text><Text className="font-semibold text-muted">{naira(order.goods_estimate)}</Text></View>
                  <View className="flex-row justify-between"><Text className="text-muted">Delivery quote</Text><Text className="font-semibold text-muted">{naira(order.delivery_quote ?? 0)}</Text></View>
                  {depositPaid ? <View className="flex-row justify-between"><Text className="text-muted">Deposit</Text><Text className="font-semibold text-muted">{naira(order.deposit_amount)} (paid)</Text></View> : null}
                  <Text className="text-xs text-faint">Final fees and total are set once shopping is finished.</Text>
                </Card>
              </>
            ) : null}

            {order.status === 'shopping' && auth ? (
              <Card>
                <SectionHeader title="Spending approval" />
                <View className="flex-row justify-between"><Text className="text-muted">Cap</Text><Text className="font-semibold text-ink">{naira(auth.cap)}</Text></View>
                <View className="flex-row justify-between"><Text className="text-muted">Spent so far</Text><Text className="font-semibold text-ink">{naira(auth.spent)}</Text></View>
                <Field placeholder="Amount to approve (₦)" value={raise} onChangeText={setRaise} keyboardType="decimal-pad" />
                <Button label="Approve increase" busy={busy} disabled={!raise} onPress={() => void act(() => api.raiseCap(id, raise), 'Could not approve increase', () => setRaise(''))} />
              </Card>
            ) : null}

            {order.status === 'awaiting_payment' ? (
              <Card>
                <SectionHeader title="Pay balance" />
                <PaymentChooser amountDue={amountDue} walletBalance={wallet} busy={busy} onPayWallet={() => void act(() => api.payBalanceWallet(id), 'Payment failed')} onPayTransfer={() => void payByTransfer('balance')} onTopUp={() => void topUp()} />
              </Card>
            ) : null}

            {priced ? (
              <Card>
                <SectionHeader title="Your bill" />
                <View className="flex-row justify-between"><Text className="text-muted">Items</Text><Text className="font-semibold text-ink">{naira(order.items_total)}</Text></View>
                <View className="flex-row justify-between"><Text className="text-muted">Service &amp; fees</Text><Text className="font-semibold text-ink">{naira(fees)}</Text></View>
                <View className="flex-row justify-between"><Text className="text-muted">Delivery</Text><Text className="font-semibold text-ink">{naira(order.delivery_fee)}</Text></View>
                {depositPaid ? <View className="flex-row justify-between"><Text className="text-muted">Deposit paid</Text><Text className="font-semibold text-ink">-{naira(order.deposit_amount)}</Text></View> : null}
                <View className="flex-row justify-between border-t border-line pt-2"><Text className="font-bold text-ink">{paidOrLater ? 'Total' : 'Amount due'}</Text><Text className="font-bold text-ink">{naira(paidOrLater ? order.grand_total : amountDue)}</Text></View>
              </Card>
            ) : null}

            {paidOrLater ? (
              <Card>
                <Text className="mb-2 font-bold text-ink">Order status</Text>
                <Timeline order={order} onPreview={setPreview} />
                {order.handover_code && order.status !== 'delivered' && order.status !== 'closed' ? (
                  <View className="mt-4 items-center rounded-2xl border border-dashed border-brand-orange/40 bg-brand-orange/[0.08] p-4">
                    <Text className="text-center text-sm font-semibold text-muted">Give this code to the rider when they hand you your order</Text>
                    <Text className="mt-1 text-3xl font-extrabold tracking-[8px] text-brand-orange-dark">{order.handover_code}</Text>
                  </View>
                ) : null}
                {riderSaysDelivered && !confirming ? (
                  <Text className="mt-4 rounded-2xl bg-brand-orange/[0.12] px-4 py-3 text-center text-sm font-semibold text-ink">Your rider says your order has been handed over. Please confirm below.</Text>
                ) : null}
                {order.status === 'out_for_delivery' && !confirming ? <Button label="Confirm delivery received" className="mt-4" onPress={() => setConfirming(true)} /> : null}
                {order.status === 'out_for_delivery' && confirming ? (
                  <View className="mt-4 gap-2 rounded-2xl bg-brand-orange/[0.12] p-4">
                    <Text className="text-sm font-semibold text-ink/80">This releases payment to your agent. Confirm you&apos;ve received everything?</Text>
                    <View className="flex-row gap-2">
                      <Button label="Cancel" variant="neutral" disabled={busy} className="flex-1" onPress={() => setConfirming(false)} />
                      <Button label="Yes, confirm" busy={busy} className="flex-1" onPress={() => void act(() => api.confirmDelivery(id), 'Could not confirm delivery', () => setConfirming(false))} />
                    </View>
                  </View>
                ) : null}
                {order.status === 'delivered' || order.status === 'closed' ? (
                  <Text className="mt-4 rounded-lg bg-brand-green/10 px-3 py-2 text-center text-sm font-semibold text-brand-green">Delivered. Thanks for shopping with Qyka!</Text>
                ) : null}
              </Card>
            ) : null}

            {showFeed || paidOrLater ? (
              <Card>
                <SectionHeader title={paidOrLater ? 'What was bought' : 'Live from the market'} />
                {items.map((it) => (
                  <ItemLine key={it.id} item={it} purchase={purchaseFor(it)} busy={busy} onPreview={setPreview} onDecide={(d) => void act(() => api.decideItem(id, it.id, d), 'Could not record your choice')} />
                ))}
              </Card>
            ) : null}

            {RATEABLE.has(order.status) ? (
              <Card>
                <SectionHeader title="Rate your agent" />
                <View className="items-center">
                  <Image source={require('../../../../../assets/illustrations/review-rating-bubble.webp')} resizeMode="contain" className="h-20 w-28" />
                </View>
                {rating ? (
                  <View className="gap-1">
                    <Text className="text-lg text-brand-orange-dark">{'★'.repeat(rating.stars)}{'☆'.repeat(5 - rating.stars)}</Text>
                    {rating.comment ? <Text className="text-sm text-muted">{rating.comment}</Text> : null}
                  </View>
                ) : (
                  <>
                    <View className="flex-row gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
                          <Text className={'text-3xl ' + (n <= stars ? 'text-brand-orange' : 'text-line-strong')}>★</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Field placeholder="Tell us how it went (optional)" value={comment} onChangeText={setComment} multiline />
                    <Button label="Submit rating" busy={busy} disabled={stars === 0} onPress={() => void act(() => api.rateAgent(id, stars, comment.trim() || null), 'Could not submit your rating', () => { setStars(0); setComment(''); })} />
                  </>
                )}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable onPress={() => setPreview(null)} className="flex-1 items-center justify-center bg-black/90 p-4">
          {preview ? <Image source={{ uri: preview }} className="h-full w-full" resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
