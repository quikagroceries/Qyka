import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import { Button, Card, ErrorBanner, Field, ItemArt, SafeAreaView, StatusBadge } from '@/components/ui';
import { api, type AgentOrder, type Hub, type Market, type OrderItem, type Purchase, type Vendor } from '@/lib/api';
import { errMsg, naira, shortId } from '@/lib/format';
import { takeAndUploadPhoto } from '@/lib/upload';
import { usePolling } from '@/lib/usePolling';

// Mirrors web's shared Shopping screen.

const POLL_MS = 8000;

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

function Photos({ urls, uploading, onAdd }: { urls: string[]; uploading: boolean; onAdd: () => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {urls.map((u, i) => (
        <Image key={u + i} source={{ uri: u }} className="h-16 w-16 rounded-lg" />
      ))}
      <Pressable onPress={onAdd} disabled={uploading} className="h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-line-strong">
        <Text className="text-xs font-semibold text-faint">{uploading ? '…' : '+ Photo'}</Text>
      </Pressable>
    </View>
  );
}

function DropAtHub({ order, onDropped }: { order: AgentOrder; onDropped: () => void }) {
  const [hubs, setHubs] = useState<Hub[] | null>(null);
  const [hubId, setHubId] = useState('');
  const [photos, setPhotos] = useState<string[]>(order.packing_photos || []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .hubsForMarket(order.market_id)
      .then((list) => {
        setHubs(list);
        if (list.length === 1) setHubId(list[0].id);
      })
      .catch((e) => {
        setHubs([]);
        setError(`Could not load the hubs for this market. ${errMsg(e)}`);
      });
  }, [order.market_id]);

  async function addPhoto() {
    setError(null);
    setUploading(true);
    try {
      const url = await takeAndUploadPhoto();
      if (url) {
        setPhotos((cur) => [...cur, url]);
        await api.addPackingPhotos(order.id, [url]).catch(() => {}); // best effort: never blocks the drop
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUploading(false);
    }
  }

  async function drop() {
    setError(null);
    setBusy(true);
    try {
      await api.dropAtHub(order.id, hubId || undefined);
      onDropped();
    } catch (e) {
      setError(`Could not record the drop-off: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card accent>
      <Text className="text-lg font-bold text-ink">Take it to the hub</Text>
      <Text className="mb-2 text-sm text-muted">
        Balance paid. Carry everything to the hub in the market and drop it with the shopkeeper. They check it in and hand it to a rider.
      </Text>
      {hubs && hubs.length > 1 ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-ink/80">Which hub are you dropping at?</Text>
          {hubs.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => setHubId(h.id)}
              className={'rounded-2xl border-2 px-4 py-3 ' + (hubId === h.id ? 'border-brand-orange bg-brand-orange/10' : 'border-line')}>
              <Text className="font-semibold text-ink">{h.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {hubs && hubs.length === 1 ? <Text className="rounded-2xl bg-sunken px-4 py-3 text-sm font-semibold text-ink">Drop at: {hubs[0].name}</Text> : null}
      {hubs && hubs.length === 0 && !error ? (
        <ErrorBanner message="This market doesn't have a hub yet, so there's nowhere to drop this order. Contact support." />
      ) : null}
      <Text className="mt-2 text-sm font-semibold text-ink/80">Photo of the goods (optional)</Text>
      <Photos urls={photos} uploading={uploading} onAdd={() => void addPhoto()} />
      <ErrorBanner message={error} />
      <Button label="I've dropped it at the hub" busy={busy} disabled={!hubId || uploading} onPress={() => void drop()} />
      {hubs && hubs.length > 1 && !hubId ? <Text className="text-center text-sm text-muted">Pick the hub first.</Text> : null}
    </Card>
  );
}

function ItemRow({
  item,
  actionable,
  selected,
  onToggle,
  stallName,
  onUnavailable,
  busy,
}: {
  item: OrderItem;
  actionable: boolean;
  selected: boolean;
  onToggle: () => void;
  stallName: string | null;
  onUnavailable: () => void;
  busy: boolean;
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
            className={'h-7 w-7 items-center justify-center rounded-md border-2 ' + (selected ? 'border-brand-orange bg-brand-orange' : 'border-line-strong bg-surface')}>
            {selected ? <Text className="font-extrabold text-ink">✓</Text> : null}
          </Pressable>
        ) : null}
        {bought ? (
          <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-green/10">
            <Text className="font-extrabold text-brand-green">✓</Text>
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
          {bought ? <Text className="font-semibold text-brand-green">Bought: {naira(item.confirmed_price!)}</Text> : null}
          {dropped ? <Text className="text-sm font-semibold text-faint">Dropped by customer</Text> : null}
          {waiting ? <Text className="text-sm font-semibold text-amber-700">Waiting for customer&apos;s decision</Text> : null}
          {overagePending ? (
            <Text className="text-sm font-semibold text-amber-700">Waiting for customer to approve {naira(item.overage_requested_price ?? 0)}</Text>
          ) : null}
        </View>
        {actionable ? (
          <Pressable onPress={onUnavailable} disabled={busy} className="rounded-2xl bg-sunken px-3 py-2 active:bg-line-strong">
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
  const [order, setOrder] = useState<AgentOrder | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);
  const loaded = useRef(false);

  // Pay-a-stall form
  const [selected, setSelected] = useState<string[]>([]);
  const [account, setAccount] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  // New stall
  const [addingStall, setAddingStall] = useState(false);
  const [stallName, setStallName] = useState('');
  const [stallDesc, setStallDesc] = useState('');
  const [stallBusy, setStallBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const fresh = await api.order(id);
      setOrder(fresh);
      loaded.current = true;
      setError(null);
      if (fresh.status === 'shopping') api.purchases(id).then(setPurchases).catch(() => {});
      api.conversations().then((l) => setUnread(l.find((c) => c.order_id === id)?.unread ?? 0)).catch(() => {});
    } catch {
      if (!loaded.current) setError('Could not load the order.');
    }
  }, [id]);
  usePolling(refresh, POLL_MS);

  const marketId = order?.market_id;
  useEffect(() => {
    if (!marketId) return;
    api.marketVendors(marketId).then(setVendors).catch(() => {});
    api.markets().then((l) => setMarket(l.find((m) => m.id === marketId) || null)).catch(() => {});
  }, [marketId]);

  async function act(fn: () => Promise<unknown>, failPrefix: string, after?: () => void | Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await after?.();
    } catch (e) {
      setError(`${failPrefix}: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const back = () => router.replace('/agent');

  if (!order) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View className="gap-3 p-4">
          <Pressable onPress={back}>
            <Text className="text-sm font-semibold text-muted">← Back</Text>
          </Pressable>
          {error ? <ErrorBanner message={error} /> : <Text className="text-muted">Loading order…</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const items = order.items || [];
  const isShopping = order.status === 'shopping';
  const stallLabel = (sid: string | null) => vendors.find((v) => v.id === sid)?.name || null;

  const selectedItems = items.filter((it) => selected.includes(it.id));
  const allPriced = selectedItems.every((it) => Number(prices[it.id]) > 0);
  const payTotal = selectedItems.reduce((sum, it) => sum + (Number(prices[it.id]) || 0), 0);
  // A price above what the customer listed needs their approval first, unless
  // that exact overage was already approved.
  const isOverage = (it: OrderItem) =>
    it.listed_price != null && Number(prices[it.id]) > Number(it.listed_price) && it.overage_decision !== 'approved';
  const anyOverage = selectedItems.some(isOverage);
  const missingPhotos = purchases.filter((p) => !p.photo_ref);
  const boughtCount = items.filter((it) => it.confirmed_price != null).length;

  const headline = order.status === 'shopping' ? `${boughtCount} of ${items.length} bought` : HEADLINE[order.status] || 'Order status';

  function toggle(itemId: string) {
    setSelected((cur) => (cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId]));
    // An approved overage pre-fills the price the agent asked for.
    const item = items.find((it) => it.id === itemId);
    if (item?.overage_decision === 'approved' && item.overage_requested_price != null) {
      setPrices((cur) => (cur[itemId] ? cur : { ...cur, [itemId]: String(item.overage_requested_price) }));
    }
  }

  async function addPayPhoto() {
    setPhotoBusy(true);
    setError(null);
    try {
      const url = await takeAndUploadPhoto();
      if (url) setPhotoUrl(url);
    } catch (e) {
      setError(`Photo upload failed (you can still pay without it): ${errMsg(e)}`);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function attachPhoto(transferId: string) {
    setAttaching(transferId);
    setError(null);
    try {
      const url = await takeAndUploadPhoto();
      if (url) {
        await api.attachPurchasePhoto(id, transferId, url);
        setPurchases(await api.purchases(id));
      }
    } catch (e) {
      setError(`Could not attach photo: ${errMsg(e)}`);
    } finally {
      setAttaching(null);
    }
  }

  async function addStall() {
    if (!stallName.trim() || !order) return;
    setError(null);
    setStallBusy(true);
    try {
      const v = await api.createVendor(order.market_id, { name: stallName.trim(), stall_description: stallDesc.trim() || undefined });
      setVendors((cur) => [...cur, v]);
      setStallName('');
      setStallDesc('');
      setAddingStall(false);
    } catch (e) {
      setError(`Could not add stall: ${errMsg(e)}`);
    } finally {
      setStallBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Pressable onPress={back} className="self-start py-1">
          <Text className="text-sm font-semibold text-muted">← Back</Text>
        </Pressable>

        <View className="gap-1.5 rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xs font-bold uppercase tracking-widest text-ink/55">
              {market?.name || 'Order'} · #{shortId(order.id)}
            </Text>
            <StatusBadge status={order.status} />
          </View>
          <Text className="text-2xl font-extrabold tracking-tight text-ink">{headline}</Text>
          {BODY[order.status] ? <Text className="text-sm leading-relaxed text-ink/70">{BODY[order.status]}</Text> : null}
        </View>

        {/* Chat with the customer exists only while the order is being shopped. */}
        {order.status === 'agent_assigned' || order.status === 'shopping' ? (
          <Pressable onPress={() => router.push(`/agent/chat/${id}`)} className="flex-row items-center justify-between rounded-3xl border border-line bg-surface p-4 shadow-sm active:bg-sunken-2">
            <Text className="text-base font-bold text-ink">Chat with customer</Text>
            {unread > 0 ? (
              <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1">
                <Text className="text-[11px] font-bold text-white">{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : (
              <Text className="text-xl text-faint">›</Text>
            )}
          </Pressable>
        ) : null}

        <ErrorBanner message={error} />

        {order.status === 'cancelled_unpaid' ? (
          <View className="rounded-2xl border-2 border-red-400 bg-red-50 p-4">
            <Text className="font-bold text-red-700">Balance not paid in time</Text>
            <Text className="mt-1 text-sm text-red-600">
              The customer didn&apos;t pay the remaining balance within the window, so this order is cancelled and the deposit is forfeited. Please return any goods you already bought.
            </Text>
          </View>
        ) : null}

        {order.status === 'agent_assigned' ? (
          <View className="gap-2">
            <Button label="Start shopping" busy={busy} onPress={() => void act(() => api.startShopping(id), 'Could not start', refresh)} />
            <Button label="Release this order" variant="neutral" busy={busy} onPress={() => void act(() => api.releaseOrder(id), 'Could not release', back)} />
          </View>
        ) : null}

        {order.status === 'paid' ? <DropAtHub order={order} onDropped={() => void refresh()} /> : null}

        {AT_HUB_NOTE[order.status] ? (
          <View className="rounded-2xl bg-brand-green/10 px-4 py-3">
            <Text className="text-sm font-semibold text-brand-green">{AT_HUB_NOTE[order.status]}</Text>
          </View>
        ) : null}

        {isShopping ? (
          addingStall ? (
            <Card>
              <Text className="text-sm font-bold text-ink">New stall at this market</Text>
              <Field placeholder="Stall name" value={stallName} onChangeText={setStallName} />
              <Field placeholder="Rough location / what they sell (optional)" value={stallDesc} onChangeText={setStallDesc} />
              <View className="flex-row gap-2">
                <Button label="Save stall" busy={stallBusy} disabled={!stallName.trim()} className="flex-1" onPress={() => void addStall()} />
                <Button
                  label="Cancel"
                  variant="neutral"
                  disabled={stallBusy}
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
            <Pressable onPress={() => setAddingStall(true)}>
              <Text className="text-sm font-semibold text-brand-orange-dark">+ Register a stall not listed here</Text>
            </Pressable>
          )
        ) : null}

        <View className="gap-2">
          {items.map((item) => {
            const bought = item.confirmed_price != null;
            const actionable =
              isShopping && !bought && !['dropped', 'unavailable', 'overage_pending'].includes(item.availability);
            return (
              <ItemRow
                key={item.id}
                item={item}
                actionable={actionable}
                selected={selected.includes(item.id)}
                onToggle={() => toggle(item.id)}
                stallName={stallLabel(item.preferred_stall_id)}
                busy={busy}
                onUnavailable={() => void act(() => api.flagUnavailable(id, item.id), 'Could not flag item', refresh)}
              />
            );
          })}
        </View>

        {isShopping && selected.length > 0 ? (
          <View className="gap-3 rounded-3xl bg-brand-orange/[0.12] p-4">
            <Text className="text-lg font-bold text-ink">
              Pay for {selected.length} item{selected.length === 1 ? '' : 's'} from this stall
            </Text>
            <Field placeholder="Vendor account number" value={account} onChangeText={setAccount} keyboardType="number-pad" />
            <Field placeholder="Bank code (e.g. 999992 for OPay)" value={bankCode} onChangeText={setBankCode} keyboardType="number-pad" />

            <View className="gap-2 border-t border-line pt-3">
              {selectedItems.map((it) => (
                <View key={it.id} className="gap-1">
                  <View className="flex-row items-center gap-2">
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
                  {isOverage(it) ? (
                    <View className="flex-row items-center justify-between gap-2 rounded-lg bg-amber-50 px-2 py-1.5">
                      <Text className="flex-1 text-xs text-amber-700">Above the {naira(it.listed_price!)} the customer listed. Needs their approval.</Text>
                      <Button
                        label="Request approval"
                        variant="neutral"
                        disabled={busy || !(Number(prices[it.id]) > 0)}
                        className="min-h-[36px] px-3"
                        onPress={() =>
                          void act(() => api.requestOverage(id, it.id, prices[it.id]), 'Could not request approval', async () => {
                            setSelected((cur) => cur.filter((x) => x !== it.id));
                            setPrices((cur) => {
                              const next = { ...cur };
                              delete next[it.id];
                              return next;
                            });
                            await refresh();
                          })
                        }
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>

            {payTotal > 0 ? (
              <View className="flex-row justify-between border-t border-line pt-2">
                <Text className="text-sm text-muted">Total to this stall</Text>
                <Text className="text-sm font-bold text-ink">{naira(payTotal)}</Text>
              </View>
            ) : null}

            <View className="flex-row items-center gap-3 border-t border-line pt-3">
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} className="h-14 w-14 rounded-lg" />
              ) : (
                <Pressable onPress={() => void addPayPhoto()} disabled={photoBusy} className="h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed border-line-strong">
                  <Text className="text-[10px] font-semibold text-faint">{photoBusy ? '…' : '+ Photo'}</Text>
                </Pressable>
              )}
              <Text className="text-sm text-muted">Purchase photo (optional)</Text>
            </View>

            <Button
              label="Pay vendor"
              busy={busy}
              disabled={!account || !bankCode || !allPriced || anyOverage}
              onPress={() =>
                void act(
                  () =>
                    api.payVendor(id, {
                      account_number: account,
                      bank_code: bankCode,
                      // Each item keeps its own typed price; the server sums them.
                      items: selected.map((itemId) => ({ item_id: itemId, price: prices[itemId] })),
                      photo_ref: photoUrl || undefined,
                    }),
                  'Payment failed',
                  async () => {
                    setSelected([]);
                    setAccount('');
                    setBankCode('');
                    setPrices({});
                    setPhotoUrl(null);
                    await refresh();
                  },
                )
              }
            />
            {anyOverage ? <Text className="text-xs text-amber-700">Request approval for the item above (or untick it) before paying the rest.</Text> : null}
          </View>
        ) : null}

        {isShopping && missingPhotos.length > 0 ? (
          <View className="gap-2 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
            <Text className="font-bold text-amber-800">
              {missingPhotos.length} purchase{missingPhotos.length === 1 ? '' : 's'} need{missingPhotos.length === 1 ? 's' : ''} a photo
            </Text>
            <Text className="text-sm text-amber-700">Money already moved for these. Just attach proof before finishing.</Text>
            {missingPhotos.map((p) => (
              <View key={p.id} className="flex-row items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                <Text className="flex-1 text-sm font-semibold text-ink/80">
                  {naira(p.amount)} · {p.account_number}
                </Text>
                <Button label="Add photo" variant="neutral" busy={attaching === p.id} disabled={attaching === p.id} className="min-h-[36px] px-3" onPress={() => void attachPhoto(p.id)} />
              </View>
            ))}
          </View>
        ) : null}

        {isShopping ? (
          <>
            <Button label="Finish shopping" variant="secondary" busy={busy} disabled={missingPhotos.length > 0} onPress={() => void act(() => api.finishShopping(id), 'Could not finish', refresh)} />
            {missingPhotos.length > 0 ? <Text className="text-center text-xs text-amber-700">Attach the photo(s) above first.</Text> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
