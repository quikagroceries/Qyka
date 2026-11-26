import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import AgentProfileSheet from '@/components/customer/AgentProfileSheet';
import OrderIdChip from '@/components/OrderIdChip';
import OrderBackdrop from '@/components/customer/OrderBackdrop';
import { PROBLEM, Progress } from '@/components/customer/orderLook';
import PaymentChooser from '@/components/customer/PaymentChooser';
import { Avatar, Button, Card, Field, Float, ItemArt, SafeAreaView, SectionHeader, StatusBadge } from '@/components/ui';
import { naira, shortId } from '@/lib/format';
import { PEOPLE, PURCHASES, WALLET_BALANCE, marketName, orderById } from '@/lib/mock';
import { CHAT, EXCEPTION, ON_THE_MOVE, PAID_OR_LATER, RATEABLE, UNPRICED, summarize } from '@/lib/orderStatus';
import type { AgentOrder, OrderItem, Purchase } from '@/lib/types';

// Short two-tone headline per stage; the longer sentence from summarize() sits under it.
const HEADLINE: Record<string, [string, string]> = {
  draft: ['Your list is', 'not sent yet'],
  proposed: ['Finding you', 'an agent'],
  agent_assigned: ['Agent', 'assigned'],
  shopping: ['Shopping', 'in progress'],
  awaiting_payment: ['Time to', 'pay up'],
  paid: ['Paid, and', 'on the way to the hub'],
  dropped_at_hub: ['At the', 'market hub'],
  received_by_hub: ['Checked in at', 'the hub'],
  ready_for_pickup: ['Ready for', 'a rider'],
  packed: ['Ready for', 'a rider'],
  out_for_delivery: ['On its way', 'to you'],
  delivered: ['Delivered', 'with care'],
  closed: ['Delivered', 'with care'],
  cancelled: ['Order', 'cancelled'],
  cancelled_unpaid: ['Order', 'cancelled'],
  disputed: ['Order', 'under review'],
};

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
              <View className={'h-8 w-8 items-center justify-center rounded-full ' + (done ? 'bg-brand-army' : isCurrent ? 'bg-brand-orange' : 'bg-sunken')}>
                {done ? <Text className="font-extrabold text-white">✓</Text> : <View className="h-2 w-2 rounded-full bg-faint" />}
              </View>
              {!last ? <View className={'my-1 w-0.5 flex-1 ' + (done ? 'bg-brand-army/40' : 'bg-line-strong')} /> : null}
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

function ItemLine({ item, purchase, onDecide, onPreview }: { item: OrderItem; purchase?: Purchase; onDecide: (d: 'buy_elsewhere' | 'dropped') => void; onPreview: (u: string) => void }) {
  const bought = item.confirmed_price != null;
  const dropped = item.availability === 'dropped';
  const unavailable = !bought && item.availability === 'unavailable';
  const elsewhere = !bought && item.availability === 'buy_elsewhere';
  const overagePending = !bought && item.availability === 'overage_pending';
  return (
    <View className="gap-2 border-t border-dashed border-line-strong py-3">
      <View className="flex-row items-center gap-3">
        <View className={'h-7 w-7 items-center justify-center rounded-full ' + (bought ? 'bg-brand-green/10' : 'bg-sunken')}>
          {bought ? <Text className="font-extrabold text-brand-army">✓</Text> : null}
        </View>
        <ItemArt name={item.description} />
        <View className="flex-1">
          <Text className={'font-semibold ' + (bought || dropped ? 'text-faint ' : 'text-ink ') + (dropped ? 'line-through' : '')}>
            {item.quantity ? `${item.quantity} × ` : ''}
            {item.description}
          </Text>
          {bought ? (
            <Text className="text-sm text-brand-army">
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
            <Button label="Try another stall" className="flex-1" onPress={() => onDecide('buy_elsewhere')} />
            <Button label="Skip it" variant="neutral" className="flex-1" onPress={() => onDecide('dropped')} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

// UI only: every action updates this screen's local copy of the order.
export default function CustomerOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const initial = orderById(id);
  const [status, setStatus] = useState(initial.status);
  const [items, setItems] = useState<OrderItem[]>(initial.items);
  const [depositPaid, setDepositPaid] = useState(!!initial.deposit_paid_at);
  const [notice, setNotice] = useState('');
  const [rating, setRating] = useState<{ stars: number; comment: string | null } | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [raise, setRaise] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);

  const order: AgentOrder = { ...initial, status, items, deposit_paid_at: depositPaid ? initial.deposit_paid_at ?? new Date().toISOString() : null };
  const market = { name: marketName(order.market_id) };
  const agent = order.agent_id ? PEOPLE.agent : null;
  const proposed = status === 'proposed' ? PEOPLE.agent : null;
  const auth = { cap: '10000.00', spent: '2800.00' };
  const purchases: Purchase[] = PURCHASES;
  const wallet = WALLET_BALANCE;

  const patchItem = (itemId: string, patch: Partial<OrderItem>) => setItems((cur) => cur.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));

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
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-10 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/customer'))}
            hitSlop={10}
            accessibilityLabel="Back"
            className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>
          <OrderIdChip id={order.id} />
          <View className="h-11 w-11" />
        </Animated.View>

        <View className="items-center gap-2">
          <Animated.View entering={FadeInDown.duration(500)}>
            <Float>
              <Image source={image} resizeMode="contain" style={{ width: 190, height: 140 }} />
            </Float>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(100).duration(500)} className="w-full items-center gap-3">
            <Text className="text-center text-[30px] font-extrabold leading-[36px] tracking-tight text-ink">
              {(HEADLINE[order.status] ?? ['Your', 'order'])[0]}
              {'\n'}
              <Text className="text-[30px] font-extrabold leading-[36px] tracking-tight text-brand-orange-dark">{(HEADLINE[order.status] ?? ['Your', 'order'])[1]}</Text>
            </Text>
            <Text className="max-w-[300px] text-center text-base leading-6 text-muted">{summarize(order, market.name)}</Text>
            <View className="flex-row flex-wrap items-center justify-center gap-2">
              <StatusBadge status={order.status} />
              <View className="rounded-full border border-line-strong bg-surface px-3 py-1">
                <Text className="text-xs font-bold text-ink">
                  {market.name || 'Market'} · {items.length} item{items.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
            {!PROBLEM.has(order.status) ? (
              <View style={{ alignSelf: 'stretch' }}>
                <Progress status={order.status} labels />
              </View>
            ) : null}
            {agent && !exception ? (
              <Pressable
                onPress={() => setAgentOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="View agent profile"
                className="flex-row items-center gap-2.5 rounded-full border border-line-strong bg-surface py-1 pl-1 pr-3 active:bg-sunken"
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <Avatar uri={agent.avatar_url} name={agent.full_name} className="h-9 w-9" />
                <View>
                  <Text className="text-[10px] font-bold uppercase tracking-wide text-faint">Your agent</Text>
                  <Text className="text-sm font-bold text-ink">{agent.full_name || 'Your agent'}</Text>
                </View>
                <Text className="text-lg text-brand-orange-dark">›</Text>
              </Pressable>
            ) : null}
            {canChat ? <Button label="Chat with agent" className="self-stretch" onPress={() => router.push(`/customer/chat/${id}`)} /> : null}
          </Animated.View>
        </View>

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
                    <Button label={`Approve extra ${naira(extra)}`} className="flex-1" onPress={() => patchItem(item.id, { availability: 'available', overage_decision: 'approved' })} />
                    <Button label="Skip this item" variant="neutral" className="flex-1" onPress={() => patchItem(item.id, { availability: 'dropped', overage_decision: 'declined' })} />
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
                  reference={`QYKA-${shortId(order.id)}`}
                  amountDue={Number(order.deposit_amount)}
                  walletBalance={wallet}
                  onPayWallet={() => setDepositPaid(true)}
                  onPayTransfer={() => setDepositPaid(true)}
                />
              </View>
            ) : null}

            {order.status === 'proposed' && !needsDeposit ? (
              <Card accent>
                <Text className="text-lg font-bold text-ink">Your shopping agent</Text>
                {proposed ? (
                  <Pressable onPress={() => setAgentOpen(true)} className="flex-row items-center gap-3 active:opacity-70">
                    <Avatar uri={proposed.avatar_url} name={proposed.full_name} className="h-14 w-14" />
                    <View>
                      <Text className="font-semibold text-ink">{proposed.full_name || 'Unnamed agent'}</Text>
                      <Text className="text-sm text-faint">{proposed.phone}</Text>
                    </View>
                  </Pressable>
                ) : (
                  <Text className="text-sm text-faint">Looking for an available agent…</Text>
                )}
                {notice ? <Text className="rounded-lg bg-brand-orange/15 px-3 py-2 text-sm text-brand-orange-dark">{notice}</Text> : null}
                <View className="flex-row gap-2">
                  <Button label="Accept" className="flex-1" onPress={() => { setNotice(''); setStatus('agent_assigned'); }} />
                  <Button label="See another" variant="neutral" className="flex-1" onPress={() => setNotice(`No other agents available in this market. ${proposed?.full_name || 'This agent'} is your only option.`)} />
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
                <Button label="Approve increase" onPress={() => setRaise('')} />
              </Card>
            ) : null}

            {order.status === 'awaiting_payment' ? (
              <Card>
                <SectionHeader title="Pay balance" />
                <PaymentChooser reference={`QYKA-${shortId(order.id)}`} amountDue={amountDue} walletBalance={wallet} onPayWallet={() => setStatus('paid')} onPayTransfer={() => setStatus('paid')} />
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
                      <Button label="Cancel" variant="neutral" className="flex-1" onPress={() => setConfirming(false)} />
                      <Button label="Yes, confirm" className="flex-1" onPress={() => { setConfirming(false); setStatus('delivered'); }} />
                    </View>
                  </View>
                ) : null}
                {order.status === 'delivered' || order.status === 'closed' ? (
                  <Text className="mt-4 rounded-lg bg-brand-green/10 px-3 py-2 text-center text-sm font-semibold text-brand-army">Delivered. Thanks for shopping with Qyka!</Text>
                ) : null}
              </Card>
            ) : null}

            {showFeed || paidOrLater ? (
              <Card>
                <SectionHeader title={paidOrLater ? 'What was bought' : 'Live from the market'} />
                {items.map((it) => (
                  <ItemLine key={it.id} item={it} purchase={purchaseFor(it)} onPreview={setPreview} onDecide={(d) => patchItem(it.id, { availability: d })} />
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
                    <Button label="Submit rating" onPress={() => { setRating({ stars: stars || 5, comment: comment.trim() || null }); setStars(0); setComment(''); }} />
                  </>
                )}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>

      <AgentProfileSheet person={agent ?? proposed} visible={agentOpen} onClose={() => setAgentOpen(false)} onChat={canChat ? () => router.push(`/customer/chat/${id}`) : undefined} />

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable onPress={() => setPreview(null)} className="flex-1 items-center justify-center bg-black/90 p-4">
          {preview ? <Image source={{ uri: preview }} className="h-full w-full" resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
