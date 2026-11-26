import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import GoodsPhotos, { ProofViewer } from '@/components/GoodsPhotos';
import { look } from '@/components/customer/orderLook';
import OrderBackdrop from '@/components/customer/OrderBackdrop';
import OrderIdChip from '@/components/OrderIdChip';
import { Button, Card, Field, Float, ItemArt, SafeAreaView, StatusBadge } from '@/components/ui';
import { naira } from '@/lib/format';
import { PLACES, stamp, type ProofPhoto } from '@/lib/proof';
import { marketName, orderById } from '@/lib/mock';
import type { AgentOrder, OrderItem } from '@/lib/types';

// Mirrors web's shared Shopping screen.

const HEADLINE: Record<string, string> = {
  agent_assigned: 'Ready to shop',
  paid: 'Take it to the hub',
  dropped_at_hub: 'Dropped: waiting for check-in',
  received_by_hub: 'At the hub: a rider is next',
  ready_for_pickup: 'At the hub: a rider is next',
  packed: 'Packed: awaiting pickup',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  closed: 'Delivered',
  cancelled_unpaid: 'Balance not paid',
};
const BODY: Record<string, string> = {
  agent_assigned: "Start shopping when you're ready: bargain live, buy, and keep proof of purchase.",
  shopping: 'Tick items as you buy them and pay each stall directly below.',
  paid: 'Carry everything to the hub in the market and drop it with the shopkeeper.',
  dropped_at_hub: 'The shopkeeper will check it in against the list.',
  received_by_hub: "You're done here. The hub hands it to a rider.",
  ready_for_pickup: "You're done here. The hub hands it to a rider.",
  cancelled_unpaid: 'The balance window lapsed. Return any goods you already bought.',
};
const AT_HUB_NOTE: Record<string, string> = {
  dropped_at_hub: 'Dropped at the hub. Waiting for the shopkeeper to check it in.',
  received_by_hub: 'The hub has checked your drop-off in.',
  ready_for_pickup: 'Ready at the hub. Waiting for a rider.',
  out_for_delivery: 'A rider has collected it and is on the way.',
  delivered: 'Delivered.',
  closed: 'Delivered.',
};

function DropAtHub({ order, onDropped }: { order: AgentOrder; onDropped: () => void }) {
  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [tried, setTried] = useState(false);
  return (
    <Card accent>
      <Text className="text-lg font-bold text-ink">Take it to the hub</Text>
      <Text className="mb-2 text-sm text-muted">
        Balance paid. Carry everything to the hub in the market and drop it with the shopkeeper. They check it in and hand it to a rider.
      </Text>
      <Text className="rounded-2xl bg-sunken px-4 py-3 text-sm font-semibold text-ink">Drop at: Mile 12 Hub</Text>
      <Text className="ml-1 mt-2 text-xs font-bold uppercase tracking-wide text-faint">Photo of the goods (required)</Text>
      <GoodsPhotos
        photos={photos}
        onChange={setPhotos}
        place={PLACES[order.market_id]}
        error={tried && photos.length === 0 ? 'Add a photo of the goods to continue.' : undefined}
        hint="Photograph everything you're handing over, together. It is your proof it was all there."
      />
      <Button label="I've dropped it at the hub" onPress={() => (photos.length === 0 ? setTried(true) : onDropped())} />
    </Card>
  );
}

function ItemRow({
  item,
  actionable,
  selected,
  onToggle,
  stallName,
  boughtFrom,
  boughtPhoto,
  onPreview,
  onUnavailable,
}: {
  item: OrderItem;
  actionable: boolean;
  selected: boolean;
  onToggle: () => void;
  stallName: string | null;
  boughtFrom?: string;
  boughtPhoto?: ProofPhoto;
  onPreview: (p: ProofPhoto) => void;
  onUnavailable: () => void;
}) {
  const bought = item.confirmed_price != null;
  const dropped = !bought && item.availability === 'dropped';
  const waiting = !bought && item.availability === 'unavailable';
  const overagePending = !bought && item.availability === 'overage_pending';
  const quiet = bought || dropped;
  return (
    <Card className={quiet ? 'bg-sunken-2 py-3' : 'py-3'}>
      <View className="flex-row items-center gap-3">
        {actionable ? (
          <Pressable
            onPress={onToggle}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`Mark ${item.description} as bought`}
            className={'h-8 w-8 items-center justify-center rounded-full border-2 ' + (selected ? 'border-brand-orange bg-brand-orange' : 'border-line-strong bg-surface')}>
            {selected ? <Text className="font-extrabold text-ink">✓</Text> : null}
          </Pressable>
        ) : null}
        {bought ? (
          <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-green/10">
            <Text className="font-extrabold text-brand-army">✓</Text>
          </View>
        ) : null}
        <ItemArt name={item.description} />
        <View className="flex-1">
          <Text className={'font-semibold ' + (quiet ? 'text-faint line-through' : 'text-ink')}>
            {item.quantity ? `${item.quantity} × ` : ''}
            {item.description}
          </Text>
          {item.requested_note && actionable ? <Text className="text-sm text-muted">{item.requested_note}</Text> : null}
          {item.listed_price != null && actionable ? <Text className="text-sm text-muted">Customer expected: {naira(item.listed_price)}</Text> : null}
          {item.preferred_stall_id && actionable ? (
            <Text className="text-sm font-semibold text-brand-orange-dark">Preferred stall: {stallName || '…'}</Text>
          ) : null}
          {bought ? (
            <Text className="font-semibold text-brand-army">
              Bought: {naira(item.confirmed_price!)}
              {boughtFrom ? <Text className="font-normal text-muted"> · {boughtFrom}</Text> : null}
            </Text>
          ) : null}
          {bought && boughtPhoto ? <Text className={'text-xs font-semibold ' + (stamp(boughtPhoto).ok ? 'text-brand-army' : 'text-amber-700')}>Photo {stamp(boughtPhoto).text}</Text> : null}
          {dropped ? <Text className="text-sm font-semibold text-faint">Dropped by customer</Text> : null}
          {waiting ? <Text className="text-sm font-semibold text-amber-700">Waiting for customer&apos;s decision</Text> : null}
          {overagePending ? (
            <Text className="text-sm font-semibold text-amber-700">Waiting for customer to approve {naira(item.overage_requested_price ?? 0)}</Text>
          ) : null}
        </View>
        {bought && boughtPhoto ? (
          <Pressable onPress={() => onPreview(boughtPhoto)} accessibilityLabel="View photo of the goods">
            <Image source={{ uri: boughtPhoto.uri }} className="h-12 w-12 rounded-xl bg-sunken" />
          </Pressable>
        ) : null}
        {actionable ? (
          <Pressable onPress={onUnavailable} className="rounded-2xl bg-sunken px-3 py-2 active:bg-line-strong">
            <Text className="text-xs font-semibold text-red-600">{item.preferred_stall_id ? `Not at ${stallName || 'this stall'}` : 'Not here'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const STALLS = ['Mama Ngozi Stall', 'Baba Tunde Provisions', 'Iya Basira Fresh Foods'];

// UI only: every action updates this screen's local copy of the order.
export default function AgentOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const initial = orderById(id);
  const [status, setStatus] = useState(initial.status);
  const [items, setItems] = useState<OrderItem[]>(initial.items);
  const order: AgentOrder = { ...initial, status, items };

  // Pay-a-stall form
  const [selected, setSelected] = useState<string[]>([]);
  const [account, setAccount] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  // New stall
  const [addingStall, setAddingStall] = useState(false);
  const [stallName, setStallName] = useState('');
  const [stallDesc, setStallDesc] = useState('');
  // Stalls this agent can pay at: the market's known ones plus any registered during this run.
  const [stalls, setStalls] = useState<string[]>(STALLS);
  const [stall, setStall] = useState(STALLS[0]);
  const [boughtFrom, setBoughtFrom] = useState<Record<string, string>>({});
  const [stallNotice, setStallNotice] = useState('');
  // The photo of the goods is required to pay a stall; each bought item keeps it as proof.
  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [triedPay, setTriedPay] = useState(false);
  const [boughtPhotos, setBoughtPhotos] = useState<Record<string, ProofPhoto>>({});
  const [viewing, setViewing] = useState<ProofPhoto | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/agent'));

  const isShopping = status === 'shopping';
  const stallLabel = (sid: string | null) => (sid ? STALLS[0] : null);

  const selectedItems = items.filter((it) => selected.includes(it.id));
  const payTotal = selectedItems.reduce((sum, it) => sum + (Number(prices[it.id]) || 0), 0);
  const boughtCount = items.filter((it) => it.confirmed_price != null).length;
  const headline = status === 'shopping' ? `${boughtCount} of ${items.length} bought` : HEADLINE[status] || 'Order status';
  // Two-tone: everything but the last word in ink, the last word in peach.
  const words = headline.split(' ');
  const headTop = words.length > 1 ? words.slice(0, -1).join(' ') : headline;
  const headAccent = words.length > 1 ? words[words.length - 1] : '';

  const toggle = (itemId: string) => setSelected((cur) => (cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId]));

  const flagUnavailable = (itemId: string) => setItems((cur) => cur.map((it) => (it.id === itemId ? { ...it, availability: 'unavailable' } : it)));

  function payVendor() {
    setItems((cur) => cur.map((it) => (selected.includes(it.id) ? { ...it, confirmed_price: prices[it.id] || it.listed_price || '0' } : it)));
    setBoughtFrom((cur) => ({ ...cur, ...Object.fromEntries(selected.map((id) => [id, stall])) }));
    if (photos[0]) setBoughtPhotos((cur) => ({ ...cur, ...Object.fromEntries(selected.map((id) => [id, photos[0]])) }));
    setPhotos([]);
    setSelected([]);
    setAccount('');
    setBankCode('');
    setPrices({});
  }

  // UI only: the stall is kept for this run. It is added to the list and selected for the next payment.
  function saveStall() {
    const name = stallName.trim();
    if (!name) return;
    setStalls((cur) => (cur.includes(name) ? cur : [...cur, name]));
    setStall(name);
    setStallNotice(`${name} added. It's selected for your next payment.`);
    setAddingStall(false);
    setStallName('');
    setStallDesc('');
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-10 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
          <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>
          <OrderIdChip id={order.id} />
          <View className="h-11 w-11" />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450)} className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-ink">
                {headTop}
                {headAccent ? <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-brand-orange-dark"> {headAccent}</Text> : null}
              </Text>
              {BODY[status] ? <Text className="text-sm leading-5 text-muted">{BODY[status]}</Text> : null}
            </View>
            <Float>
              <Image source={look(order).art} resizeMode="contain" style={{ width: 92, height: 70 }} />
            </Float>
          </View>
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <View className="rounded-full border border-line-strong bg-surface px-3 py-1">
              <Text className="text-xs font-bold text-ink">
                {marketName(order.market_id) || 'Market'} · {items.length} item{items.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          {status === 'shopping' && items.length > 0 ? (
            <View className="gap-1.5">
              <View className="h-2 overflow-hidden rounded-full bg-line-strong">
                <View className="h-2 rounded-full bg-brand-orange" style={{ width: `${(boughtCount / items.length) * 100}%` }} />
              </View>
              <Text className="text-xs font-semibold text-muted">
                <Text className="font-extrabold text-ink">{boughtCount}</Text> of {items.length} bought
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Chat with the customer exists only while the order is being shopped. */}
        {status === 'agent_assigned' || status === 'shopping' ? (
          <Pressable
            onPress={() => router.push(`/agent/chat/${order.id}`)}
            className="flex-row items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm active:bg-surface-2"
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange/15">
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#D9702F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </Svg>
            </View>
            <View className="flex-1">
              <Text className="text-base font-extrabold text-ink">Chat with customer</Text>
              <Text className="text-xs text-muted">Photos, price questions and substitutions</Text>
            </View>
            <Text className="text-2xl text-brand-orange-dark">›</Text>
          </Pressable>
        ) : null}

        {status === 'cancelled_unpaid' ? (
          <View className="rounded-2xl border-2 border-red-400 bg-red-50 p-4">
            <Text className="font-bold text-red-700">Balance not paid in time</Text>
            <Text className="mt-1 text-sm text-red-600">
              The customer didn&apos;t pay the remaining balance within the window, so this order is cancelled and the deposit is forfeited. Please return any goods you already bought.
            </Text>
          </View>
        ) : null}

        {status === 'agent_assigned' ? (
          <View className="gap-2">
            <Button label="Start shopping" onPress={() => setStatus('shopping')} />
            <Button label="Release this order" variant="neutral" onPress={back} />
          </View>
        ) : null}

        {status === 'paid' ? <DropAtHub order={order} onDropped={() => setStatus('dropped_at_hub')} /> : null}

        {AT_HUB_NOTE[status] ? (
          <View className="rounded-2xl bg-brand-green/10 px-4 py-3">
            <Text className="text-sm font-semibold text-brand-army">{AT_HUB_NOTE[status]}</Text>
          </View>
        ) : null}

        {isShopping ? (
          addingStall ? (
            <Card>
              <Text className="text-sm font-bold text-ink">New stall at this market</Text>
              <Field placeholder="Stall name" value={stallName} onChangeText={setStallName} />
              <Field placeholder="Rough location / what they sell (optional)" value={stallDesc} onChangeText={setStallDesc} />
              <View className="flex-row gap-2">
                <Button label="Save stall" className="flex-1" disabled={!stallName.trim()} onPress={saveStall} />
                <Button
                  label="Cancel"
                  variant="neutral"
                  className="flex-1"
                  onPress={() => {
                    setAddingStall(false);
                    setStallName('');
                    setStallDesc('');
                  }}
                />
              </View>
            </Card>
          ) : (
            <View className="gap-2">
              {stallNotice ? (
                <View className="flex-row items-center gap-2 rounded-2xl bg-brand-green/15 px-4 py-3">
                  <Text className="text-sm font-extrabold text-brand-army">✓</Text>
                  <Text className="flex-1 text-sm font-semibold text-brand-army">{stallNotice}</Text>
                </View>
              ) : null}
              <Button label="Register a stall not listed here" variant="outline" onPress={() => { setStallNotice(''); setAddingStall(true); }} />
            </View>
          )
        ) : null}

        {isShopping && selected.length === 0 && items.some((it) => it.confirmed_price == null && !['dropped', 'unavailable', 'overage_pending'].includes(it.availability)) ? (
          <View className="flex-row items-start gap-3 rounded-2xl bg-brand-orange/[0.12] px-4 py-3">
            <Text className="text-base font-extrabold text-brand-orange-dark">1</Text>
            <Text className="flex-1 text-sm leading-5 text-ink/80">
              Bought something? <Text className="font-bold text-ink">Tap the circle next to it</Text>, then enter the price and pay the stall. It&apos;s marked bought once you pay.
            </Text>
          </View>
        ) : null}

        <View className="gap-2">
          {items.map((item) => {
            const bought = item.confirmed_price != null;
            const actionable = isShopping && !bought && !['dropped', 'unavailable', 'overage_pending'].includes(item.availability);
            return (
              <ItemRow
                key={item.id}
                item={item}
                actionable={actionable}
                selected={selected.includes(item.id)}
                onToggle={() => toggle(item.id)}
                stallName={stallLabel(item.preferred_stall_id)}
                boughtFrom={boughtFrom[item.id]}
                boughtPhoto={boughtPhotos[item.id]}
                onPreview={setViewing}
                onUnavailable={() => flagUnavailable(item.id)}
              />
            );
          })}
        </View>

        {isShopping && selected.length > 0 ? (
          <View className="gap-3 rounded-3xl bg-brand-orange/[0.12] p-4">
            <Text className="text-lg font-bold text-ink">
              Pay for {selected.length} item{selected.length === 1 ? '' : 's'} from this stall
            </Text>
            <View className="gap-1.5">
              <Text className="ml-1 text-xs font-bold uppercase tracking-wide text-faint">Which stall?</Text>
              <View className="flex-row flex-wrap gap-2">
                {stalls.map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => setStall(name)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: stall === name }}
                    className={'rounded-full border px-3.5 py-2 ' + (stall === name ? 'border-brand-orange bg-brand-orange' : 'border-line-strong bg-surface')}>
                    <Text className={'text-sm font-bold ' + (stall === name ? 'text-ink' : 'text-muted')}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Field placeholder="Vendor account number" value={account} onChangeText={setAccount} keyboardType="number-pad" />
            <Field placeholder="Bank code (e.g. 999992 for OPay)" value={bankCode} onChangeText={setBankCode} keyboardType="number-pad" />

            <View className="gap-2 border-t border-line pt-3">
              {selectedItems.map((it) => (
                <View key={it.id} className="flex-row items-center gap-2">
                  <Text className="flex-1 text-sm text-ink/80" numberOfLines={1}>
                    {it.description}
                  </Text>
                  <Field
                    placeholder="₦ price"
                    value={prices[it.id] || ''}
                    onChangeText={(t) => setPrices((cur) => ({ ...cur, [it.id]: t }))}
                    keyboardType="decimal-pad"
                    className="w-28 py-2.5"
                  />
                </View>
              ))}
            </View>

            {payTotal > 0 ? (
              <View className="flex-row justify-between border-t border-line pt-2">
                <Text className="text-sm text-muted">Total to this stall</Text>
                <Text className="text-sm font-bold text-ink">{naira(payTotal)}</Text>
              </View>
            ) : null}

            <View className="gap-2 border-t border-line pt-3">
              <Text className="ml-1 text-xs font-bold uppercase tracking-wide text-faint">Photo of the goods (required)</Text>
              <GoodsPhotos
                photos={photos}
                onChange={setPhotos}
                place={PLACES[order.market_id]}
                max={3}
                error={triedPay && photos.length === 0 ? 'Add a photo of what you bought to pay.' : undefined}
                hint="Take a clear photo of what you bought. It's your proof of purchase."
              />
            </View>

            <Button label="Pay vendor" onPress={() => (photos.length === 0 ? setTriedPay(true) : payVendor())} />
          </View>
        ) : null}

        {isShopping ? <Button label="Finish shopping" variant="secondary" onPress={() => setStatus('awaiting_payment')} /> : null}
      </ScrollView>

      <ProofViewer photo={viewing} onClose={() => setViewing(null)} />
    </SafeAreaView>
  );
}
