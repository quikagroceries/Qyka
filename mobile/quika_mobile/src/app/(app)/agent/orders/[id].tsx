import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import { Button, Card, Field, ItemArt, SafeAreaView, StatusBadge } from '@/components/ui';
import { naira, shortId } from '@/lib/format';
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

function Photos({ urls }: { urls: string[] }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {urls.map((u, i) => (
        <Image key={u + i} source={{ uri: u }} className="h-16 w-16 rounded-lg" />
      ))}
      <Pressable className="h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-line-strong">
        <Text className="text-xs font-semibold text-faint">+ Photo</Text>
      </Pressable>
    </View>
  );
}

function DropAtHub({ order, onDropped }: { order: AgentOrder; onDropped: () => void }) {
  return (
    <Card accent>
      <Text className="text-lg font-bold text-ink">Take it to the hub</Text>
      <Text className="mb-2 text-sm text-muted">
        Balance paid. Carry everything to the hub in the market and drop it with the shopkeeper. They check it in and hand it to a rider.
      </Text>
      <Text className="rounded-2xl bg-sunken px-4 py-3 text-sm font-semibold text-ink">Drop at: Mile 12 Hub</Text>
      <Text className="mt-2 text-sm font-semibold text-ink/80">Photo of the goods (optional)</Text>
      <Photos urls={order.packing_photos || []} />
      <Button label="I've dropped it at the hub" onPress={onDropped} />
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
}: {
  item: OrderItem;
  actionable: boolean;
  selected: boolean;
  onToggle: () => void;
  stallName: string | null;
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

  const back = () => router.replace('/agent');

  const isShopping = status === 'shopping';
  const stallLabel = (sid: string | null) => (sid ? STALLS[0] : null);

  const selectedItems = items.filter((it) => selected.includes(it.id));
  const payTotal = selectedItems.reduce((sum, it) => sum + (Number(prices[it.id]) || 0), 0);
  const boughtCount = items.filter((it) => it.confirmed_price != null).length;
  const headline = status === 'shopping' ? `${boughtCount} of ${items.length} bought` : HEADLINE[status] || 'Order status';

  const toggle = (itemId: string) => setSelected((cur) => (cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId]));

  const flagUnavailable = (itemId: string) => setItems((cur) => cur.map((it) => (it.id === itemId ? { ...it, availability: 'unavailable' } : it)));

  function payVendor() {
    setItems((cur) => cur.map((it) => (selected.includes(it.id) ? { ...it, confirmed_price: prices[it.id] || it.listed_price || '0' } : it)));
    setSelected([]);
    setAccount('');
    setBankCode('');
    setPrices({});
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
              {marketName(order.market_id) || 'Order'} · #{shortId(order.id)}
            </Text>
            <StatusBadge status={status} />
          </View>
          <Text className="text-2xl font-extrabold tracking-tight text-ink">{headline}</Text>
          {BODY[status] ? <Text className="text-sm leading-relaxed text-ink/70">{BODY[status]}</Text> : null}
        </View>

        {/* Chat with the customer exists only while the order is being shopped. */}
        {status === 'agent_assigned' || status === 'shopping' ? (
          <Pressable onPress={() => router.push(`/agent/chat/${order.id}`)} className="flex-row items-center justify-between rounded-3xl border border-line bg-surface p-4 shadow-sm active:bg-sunken-2">
            <Text className="text-base font-bold text-ink">Chat with customer</Text>
            <Text className="text-xl text-faint">›</Text>
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
            <Text className="text-sm font-semibold text-brand-green">{AT_HUB_NOTE[status]}</Text>
          </View>
        ) : null}

        {isShopping ? (
          addingStall ? (
            <Card>
              <Text className="text-sm font-bold text-ink">New stall at this market</Text>
              <Field placeholder="Stall name" value={stallName} onChangeText={setStallName} />
              <Field placeholder="Rough location / what they sell (optional)" value={stallDesc} onChangeText={setStallDesc} />
              <View className="flex-row gap-2">
                <Button
                  label="Save stall"
                  className="flex-1"
                  onPress={() => {
                    setAddingStall(false);
                    setStallName('');
                    setStallDesc('');
                  }}
                />
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
            <Pressable onPress={() => setAddingStall(true)}>
              <Text className="text-sm font-semibold text-brand-orange-dark">+ Register a stall not listed here</Text>
            </Pressable>
          )
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

            <View className="flex-row items-center gap-3 border-t border-line pt-3">
              <Pressable className="h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed border-line-strong">
                <Text className="text-[10px] font-semibold text-faint">+ Photo</Text>
              </Pressable>
              <Text className="text-sm text-muted">Purchase photo (optional)</Text>
            </View>

            <Button label="Pay vendor" onPress={payVendor} />
          </View>
        ) : null}

        {isShopping ? <Button label="Finish shopping" variant="secondary" onPress={() => setStatus('awaiting_payment')} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
