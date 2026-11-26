import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import GoodsPhotos from '@/components/GoodsPhotos';
import { look } from '@/components/customer/orderLook';
import OrderBackdrop from '@/components/customer/OrderBackdrop';
import OrderIdChip from '@/components/OrderIdChip';
import { Button, Card, Field, Float, ItemArt, SafeAreaView, StatusBadge } from '@/components/ui';
import { naira } from '@/lib/format';
import { api, type Hub, type Vendor } from '@/lib/api';
import { useMarkets } from '@/lib/catalog';
import { agentOrderStore, useAgentOrder, useAgentOrderState, useAgentOrderSync } from '@/lib/orderStore';
import type { Place, ProofPhoto } from '@/lib/proof';
import type { AgentOrder, OrderItem, Purchase } from '@/lib/types';

// The agent's shopping screen, live from the server (mirrors the web's shared Shopping screen).

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

/** Taking the paid order to the hub: pick the hub, photograph the goods, and drop. The hub's shopkeeper checks it in from there. */
function DropAtHub({ order, place }: { order: AgentOrder; place?: Place }) {
  const [hubs, setHubs] = useState<Hub[] | null>(null);
  const [hubId, setHubId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let alive = true;
    api.getHubs(order.market_id)
      .then((h) => alive && setHubs(h.filter((x) => x.is_active)))
      .catch((e: Error) => {
        if (!alive) return;
        setHubs([]);
        setProblem(e.message);
      });
    return () => {
      alive = false;
    };
  }, [order.market_id]);

  const drop = async () => {
    if (photos.length === 0) return setTried(true);
    if (hubs && hubs.length > 1 && !hubId) return setProblem('Choose the hub you are dropping at.');
    setBusy(true);
    setProblem('');
    try {
      const refs = await Promise.all(photos.map((p) => api.uploadImage(p.uri)));
      await api.dropAtHub(order.id, hubId ?? undefined);
      // The drop has happened; if the photos fail to attach, the shopkeeper still checks the goods in.
      await api.addPackingPhotos(order.id, refs).catch(() => undefined);
      await agentOrderStore.load(order.id);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card accent>
      <Text className="text-lg font-bold text-ink">Take it to the hub</Text>
      <Text className="mb-2 text-sm text-muted">
        Balance paid. Carry everything to the hub in the market and drop it with the shopkeeper. They check it in and hand it to a rider.
      </Text>
      {hubs === null ? (
        <Text className="rounded-2xl bg-sunken px-4 py-3 text-sm text-muted">Finding the hub…</Text>
      ) : hubs.length === 0 ? (
        <Text className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">This market has no hub set up yet. Please tell Qyka.</Text>
      ) : hubs.length === 1 ? (
        <Text className="rounded-2xl bg-sunken px-4 py-3 text-sm font-semibold text-ink">Drop at: {hubs[0].name}</Text>
      ) : (
        <View className="gap-1.5">
          <Text className="ml-1 text-xs font-bold uppercase tracking-wide text-faint">Which hub?</Text>
          <View className="flex-row flex-wrap gap-2">
            {hubs.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setHubId(h.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: hubId === h.id }}
                className={'rounded-full border px-3.5 py-2 ' + (hubId === h.id ? 'border-brand-orange bg-brand-orange' : 'border-line-strong bg-surface')}>
                <Text className={'text-sm font-bold ' + (hubId === h.id ? 'text-ink' : 'text-muted')}>{h.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      <Text className="ml-1 mt-2 text-xs font-bold uppercase tracking-wide text-faint">Photo of the goods (required)</Text>
      <GoodsPhotos
        photos={photos}
        onChange={setPhotos}
        place={place}
        error={tried && photos.length === 0 ? 'Add a photo of the goods to continue.' : undefined}
        hint="Photograph everything you're handing over, together. It is your proof it was all there."
      />
      {problem ? <Text className="text-sm font-semibold text-red-700">{problem}</Text> : null}
      <Button label="I've dropped it at the hub" busy={busy} disabled={hubs !== null && hubs.length === 0} onPress={drop} />
    </Card>
  );
}

function ItemRow({
  item,
  actionable,
  selected,
  onToggle,
  stallName,
  receiptUri,
  onPreview,
  onUnavailable,
}: {
  item: OrderItem;
  actionable: boolean;
  selected: boolean;
  onToggle: () => void;
  stallName: string | null;
  /** The photo the agent attached when paying for this item. */
  receiptUri?: string | null;
  onPreview: (uri: string) => void;
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
          {item.preferred_stall_id && actionable ? <Text className="text-sm font-semibold text-brand-orange-dark">Preferred stall: {stallName || '…'}</Text> : null}
          {bought ? <Text className="font-semibold text-brand-army">Bought: {naira(item.confirmed_price!)}</Text> : null}
          {dropped ? <Text className="text-sm font-semibold text-faint">Dropped by customer</Text> : null}
          {waiting ? <Text className="text-sm font-semibold text-amber-700">Waiting for customer&apos;s decision</Text> : null}
          {overagePending ? <Text className="text-sm font-semibold text-amber-700">Waiting for customer to approve {naira(item.overage_requested_price ?? 0)}</Text> : null}
        </View>
        {bought && receiptUri ? (
          <Pressable onPress={() => onPreview(receiptUri)} accessibilityLabel="View photo of the goods">
            <Image source={{ uri: receiptUri }} className="h-12 w-12 rounded-xl bg-sunken" />
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

export default function AgentOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // The order comes from the server and is asked for again every few seconds, so the customer's approvals and payments show up here.
  useAgentOrderSync(id);
  const { loaded, error: loadError } = useAgentOrderState();
  const found = useAgentOrder(id);
  const { markets } = useMarkets();

  // Pay-a-stall form
  const [selected, setSelected] = useState<string[]>([]);
  const [account, setAccount] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  // The photo of the goods is required to pay a stall; the server keeps it with the payment as the receipt.
  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [triedPay, setTriedPay] = useState(false);
  // True when the server refused a price above what the customer approved: the agent can ask them to approve more.
  const [needsApproval, setNeedsApproval] = useState(false);
  // The stalls in this market, and registering one that isn't listed.
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [addingStall, setAddingStall] = useState(false);
  const [stallName, setStallName] = useState('');
  const [stallDesc, setStallDesc] = useState('');
  const [stallNotice, setStallNotice] = useState('');
  const [purchases, setPurchases] = useState<(Purchase & { status: string })[]>([]);
  const [viewingUri, setViewingUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');

  const status = found?.status;
  const marketId = found?.market_id;
  const boughtCount = found ? found.items.filter((it) => it.confirmed_price != null).length : 0;

  useEffect(() => {
    if (!marketId || status !== 'shopping') return;
    let alive = true;
    api.getVendors(marketId).then((v) => alive && setVendors(v)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [marketId, status]);

  // Each stall payment, with its photo, shown on the items it covered.
  useEffect(() => {
    if (!id || !status || status === 'agent_assigned') return;
    let alive = true;
    api.getPurchases(id).then((p) => alive && setPurchases(p)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, status, boughtCount]);

  // Runs something on the server, then reloads the order. Any failure is shown near the top of the page.
  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      await fn();
      await agentOrderStore.load(id);
      after?.();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/agent'));

  if (!found) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-8" edges={['top']}>
        <Text className="text-center text-base text-muted">{loaded && loadError ? loadError : loaded ? "We couldn't find that order." : 'Loading the order…'}</Text>
        <Button label="Back" variant="outline" onPress={back} />
      </SafeAreaView>
    );
  }

  const order: AgentOrder = found;
  const items = order.items;
  const market = markets.find((m) => m.id === order.market_id);
  // Photos are checked against the market, when the server knows where it is.
  const place: Place | undefined = market && market.latitude != null && market.longitude != null ? { name: market.name, latitude: market.latitude, longitude: market.longitude } : undefined;

  const isShopping = status === 'shopping';
  const stallLabel = (sid: string | null) => vendors.find((v) => v.id === sid)?.name ?? null;
  const receiptFor = (it: OrderItem) => purchases.find((p) => p.id === it.vendor_transfer_id)?.photo_ref ?? null;

  const selectedItems = items.filter((it) => selected.includes(it.id));
  const payTotal = selectedItems.reduce((sum, it) => sum + (Number(prices[it.id]) || 0), 0);
  const headline = status === 'shopping' ? `${boughtCount} of ${items.length} bought` : HEADLINE[status as string] || 'Order status';
  // Two-tone: everything but the last word in ink, the last word in peach.
  const words = headline.split(' ');
  const headTop = words.length > 1 ? words.slice(0, -1).join(' ') : headline;
  const headAccent = words.length > 1 ? words[words.length - 1] : '';

  const toggle = (itemId: string) => setSelected((cur) => (cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId]));

  // Pays the stall from the company's float. The server checks the customer's cap and the float, then moves the money.
  async function payVendor() {
    setProblem('');
    setNotice('');
    setNeedsApproval(false);
    const acct = account.replace(/\D/g, '');
    if (acct.length !== 10) return setProblem("Enter the stall owner's 10-digit account number.");
    if (!bankCode.trim()) return setProblem('Enter the stall owner’s bank code.');
    if (selectedItems.some((it) => !(Number(prices[it.id]) > 0))) return setProblem('Enter the price you paid for each item.');
    if (photos.length === 0) return setTriedPay(true);
    setBusy(true);
    try {
      const receipt = await api.uploadImage(photos[0].uri);
      await api.payVendor(order.id, {
        account_number: acct,
        bank_code: bankCode.trim(),
        items: selectedItems.map((it) => ({ item_id: it.id, price: Number(prices[it.id]).toFixed(2) })),
        ...(vendorId ? { seller_id: vendorId } : {}),
        photo_ref: receipt,
      });
      await agentOrderStore.load(order.id);
      setSelected([]);
      setAccount('');
      setBankCode('');
      setPrices({});
      setPhotos([]);
      setTriedPay(false);
    } catch (e) {
      const m = (e as Error).message;
      setProblem(m);
      setNeedsApproval(/cap|approve/i.test(m));
    } finally {
      setBusy(false);
    }
  }

  // The price is above what the customer approved: ask them to approve it, then pay once they do.
  const askCustomer = () =>
    act(async () => {
      for (const it of selectedItems) await api.requestOverage(order.id, it.id, Number(prices[it.id]));
      setSelected([]);
      setPrices({});
      setNeedsApproval(false);
      setNotice('Asked the customer to approve. You can pay once they do.');
    });

  // Registers a stall that isn't listed. It is live straight away, and selected for the next payment.
  const saveStall = () =>
    act(async () => {
      const v = await api.createVendor(order.market_id, { name: stallName.trim(), ...(stallDesc.trim() ? { stall_description: stallDesc.trim() } : {}) });
      setVendors((cur) => [...cur, v]);
      setVendorId(v.id);
      setStallNotice(`${v.name} added. It's selected for your next payment.`);
      setAddingStall(false);
      setStallName('');
      setStallDesc('');
    });

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
              {BODY[status as string] ? <Text className="text-sm leading-5 text-muted">{BODY[status as string]}</Text> : null}
            </View>
            <Float>
              <Image source={look(order).art} resizeMode="contain" style={{ width: 92, height: 70 }} />
            </Float>
          </View>
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <View className="rounded-full border border-line-strong bg-surface px-3 py-1">
              <Text className="text-xs font-bold text-ink">
                {market?.name || 'Market'} · {items.length} item{items.length === 1 ? '' : 's'}
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

        {problem ? (
          <View className="gap-2 rounded-2xl bg-red-50 px-4 py-3">
            <Text className="text-sm font-semibold text-red-700">{problem}</Text>
            {needsApproval ? (
              <Button label="Ask the customer to approve this price" variant="outline" disabled={busy} onPress={askCustomer} />
            ) : null}
          </View>
        ) : null}
        {notice ? (
          <View className="rounded-2xl bg-brand-green/15 px-4 py-3">
            <Text className="text-sm font-semibold text-brand-army">{notice}</Text>
          </View>
        ) : null}

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
            <Button label="Start shopping" busy={busy} onPress={() => act(() => api.startShopping(order.id))} />
            <Button label="Release this order" variant="neutral" disabled={busy} onPress={() => act(() => api.releaseOrder(order.id), back)} />
          </View>
        ) : null}

        {status === 'paid' ? <DropAtHub order={order} place={place} /> : null}

        {AT_HUB_NOTE[status as string] ? (
          <View className="rounded-2xl bg-brand-green/10 px-4 py-3">
            <Text className="text-sm font-semibold text-brand-army">{AT_HUB_NOTE[status as string]}</Text>
          </View>
        ) : null}

        {isShopping ? (
          addingStall ? (
            <Card>
              <Text className="text-sm font-bold text-ink">New stall at this market</Text>
              <Field placeholder="Stall name" value={stallName} onChangeText={setStallName} />
              <Field placeholder="Rough location / what they sell (optional)" value={stallDesc} onChangeText={setStallDesc} />
              <View className="flex-row gap-2">
                <Button label="Save stall" className="flex-1" busy={busy} disabled={!stallName.trim()} onPress={saveStall} />
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
                receiptUri={receiptFor(item)}
                onPreview={setViewingUri}
                onUnavailable={() => act(() => api.flagUnavailable(order.id, item.id))}
              />
            );
          })}
        </View>

        {isShopping && selected.length > 0 ? (
          <View className="gap-3 rounded-3xl bg-brand-orange/[0.12] p-4">
            <Text className="text-lg font-bold text-ink">
              Pay for {selected.length} item{selected.length === 1 ? '' : 's'} from this stall
            </Text>
            {vendors.length > 0 ? (
              <View className="gap-1.5">
                <Text className="ml-1 text-xs font-bold uppercase tracking-wide text-faint">Which stall?</Text>
                <View className="flex-row flex-wrap gap-2">
                  {vendors.map((v) => (
                    <Pressable
                      key={v.id}
                      onPress={() => setVendorId(vendorId === v.id ? null : v.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: vendorId === v.id }}
                      className={'rounded-full border px-3.5 py-2 ' + (vendorId === v.id ? 'border-brand-orange bg-brand-orange' : 'border-line-strong bg-surface')}>
                      <Text className={'text-sm font-bold ' + (vendorId === v.id ? 'text-ink' : 'text-muted')}>{v.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <Field placeholder="Vendor account number" value={account} onChangeText={(t) => setAccount(t.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" maxLength={10} />
            <Field placeholder="Bank code (e.g. 999992 for OPay)" value={bankCode} onChangeText={(t) => setBankCode(t.replace(/\D/g, ''))} keyboardType="number-pad" />

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
                place={place}
                max={1}
                error={triedPay && photos.length === 0 ? 'Add a photo of what you bought to pay.' : undefined}
                hint="Take a clear photo of what you bought. It's your proof of purchase."
              />
            </View>

            <Button label="Pay vendor" busy={busy} onPress={payVendor} />
          </View>
        ) : null}

        {isShopping ? <Button label="Finish shopping" variant="secondary" disabled={busy} onPress={() => act(() => api.finishShopping(order.id))} /> : null}
      </ScrollView>

      <Modal visible={!!viewingUri} transparent animationType="fade" onRequestClose={() => setViewingUri(null)}>
        <Pressable onPress={() => setViewingUri(null)} className="flex-1 items-center justify-center bg-black/90 p-4">
          {viewingUri ? <Image source={{ uri: viewingUri }} className="h-full w-full" resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
