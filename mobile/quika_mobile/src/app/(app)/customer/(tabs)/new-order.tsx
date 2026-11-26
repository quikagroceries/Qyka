import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import FlowSteps, { type FlowStepKey } from '@/components/customer/FlowSteps';
import { Button, Card, Field, ItemArt, SafeAreaView, SectionHeader } from '@/components/ui';
import { naira } from '@/lib/format';
import { MARKETS, ORDERS, PRICING } from '@/lib/mock';
import { useSession } from '@/lib/session';
import type { Market } from '@/lib/types';

type Row = { item: string; price: string; qty: string; note: string };
const blank = (): Row => ({ item: '', price: '', qty: '', note: '' });

// The same four steps as the web: your list, the market, where to deliver,
// then the estimate. State lives here so going back never loses anything.
export default function NewOrder() {
  const router = useRouter();
  const { user } = useSession();
  const pricing = PRICING;

  const [step, setStep] = useState<FlowStepKey>('list');
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [budget, setBudget] = useState('');
  const [market, setMarket] = useState<Market | null>(null);
  const [query, setQuery] = useState('');
  const [address, setAddress] = useState(user?.default_delivery_address ?? '');

  const filled = rows.filter((r) => r.item.trim());
  const priced = filled.filter((r) => Number(r.price) > 0);
  const unpriced = filled.filter((r) => !(Number(r.price) > 0));
  const budgetTotal = unpriced.length > 0 ? Number(budget) || 0 : 0;
  const goodsTotal = priced.reduce((s, r) => s + Number(r.price), 0) + budgetTotal;

  const serviceFee = goodsTotal * pricing.serviceFeeRate;
  const deposit = goodsTotal * pricing.depositRate;

  const shownMarkets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MARKETS.filter((m) => !q || [m.name, m.city, m.state].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [query]);

  const setRow = (i: number, patch: Partial<Row>) => setRows((cur) => cur.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  // UI only: nothing is sent anywhere, so placing an order just opens a sample one.
  const place = () => router.replace(`/customer/orders/${ORDERS[2].id}`);

  const Header = (
    <View className="gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <FlowSteps current={step} onStepClick={setStep} />
      {market && step !== 'market' ? (
        <Pressable onPress={() => setStep('market')} className="self-start rounded-full border border-line-strong bg-surface px-3 py-1.5">
          <Text className="text-xs font-bold text-ink">
            Shopping at {market.name} <Text className="font-semibold text-faint">· change</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {Header}

        {step === 'list' ? (
          <>
            <View className="gap-1">
              <Text className="text-2xl font-extrabold tracking-tight text-ink">What do you need from the market?</Text>
              <Text className="text-sm text-muted">Write it the way you&apos;d tell someone: the item, and roughly what you expect to pay.</Text>
            </View>
            {rows.map((r, i) => (
              <Card key={i}>
                <View className="flex-row items-center gap-2">
                  <Field className="flex-1" placeholder="e.g. 500 naira pepper" value={r.item} onChangeText={(t) => setRow(i, { item: t })} />
                  {rows.length > 1 ? (
                    <Pressable onPress={() => setRows((cur) => cur.filter((_, k) => k !== i))} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full bg-sunken">
                      <Text className="text-lg text-muted">×</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View className="flex-row gap-2">
                  <Field className="flex-1" placeholder="Price ₦ (optional)" value={r.price} onChangeText={(t) => setRow(i, { price: t })} keyboardType="decimal-pad" />
                  <Field className="w-24" placeholder="Qty" value={r.qty} onChangeText={(t) => setRow(i, { qty: t.replace(/\D/g, '') })} keyboardType="number-pad" />
                </View>
                <Field placeholder="Note: stall, ripeness, brand (optional)" value={r.note} onChangeText={(t) => setRow(i, { note: t })} />
              </Card>
            ))}
            <Button label="+ Add another item" variant="neutral" onPress={() => setRows((cur) => [...cur, blank()])} />

            {unpriced.length > 0 ? (
              <Card>
                <SectionHeader title="Budget for unpriced items" subtitle={`${unpriced.length} item${unpriced.length === 1 ? ' has' : 's have'} no price. About how much should they cost in total?`} />
                <Field placeholder="Total budget ₦" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" />
              </Card>
            ) : null}

            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="text-muted">Your estimate · {filled.length} item{filled.length === 1 ? '' : 's'}</Text>
                <Text className="text-xl font-extrabold text-ink">{naira(goodsTotal)}</Text>
              </View>
              <Button label="Continue" onPress={() => setStep(market ? 'address' : 'market')} />
            </Card>
          </>
        ) : null}

        {step === 'market' ? (
          <>
            <View className="gap-1">
              <Text className="text-2xl font-extrabold tracking-tight text-ink">Which market?</Text>
              <Text className="text-sm text-muted">Where should your agent shop your list?</Text>
            </View>
            <Field placeholder="Search markets" value={query} onChangeText={setQuery} autoCapitalize="none" />
            {shownMarkets.length === 0 ? <Text className="text-muted">No markets match your search.</Text> : null}
            {shownMarkets.map((m) => {
              const selected = market?.id === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    setMarket(m);
                    setStep('address');
                  }}
                  className="active:opacity-80">
                  <Card accent={selected}>
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-lg font-extrabold text-ink">{m.name}</Text>
                        <Text className="text-sm text-muted">{[m.city, m.state].filter(Boolean).join(', ')}</Text>
                      </View>
                    </View>
                    {m.description ? <Text className="text-sm text-muted" numberOfLines={2}>{m.description}</Text> : null}
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {step === 'address' ? (
          <>
            <View className="gap-1">
              <Text className="text-2xl font-extrabold tracking-tight text-ink">Where to?</Text>
              <Text className="text-sm text-muted">We&apos;ll deliver your haul from {market?.name || 'the market'} here.</Text>
            </View>
            {user?.default_delivery_address && address !== user.default_delivery_address ? (
              <Pressable onPress={() => setAddress(user.default_delivery_address!)} className="rounded-2xl bg-sunken px-4 py-3">
                <Text className="text-xs font-bold uppercase tracking-wide text-faint">Saved address</Text>
                <Text className="font-semibold text-ink">{user.default_delivery_address}</Text>
              </Pressable>
            ) : null}
            <Field placeholder="Street, area, landmark" value={address} onChangeText={setAddress} multiline className="min-h-[88px]" />
            <Text className="text-xs text-faint">Include a landmark or gate colour. It helps the rider find you.</Text>
            <Button label="Continue" onPress={() => setStep('quote')} />
          </>
        ) : null}

        {step === 'quote' && market ? (
          <>
            <View className="gap-1">
              <Text className="text-2xl font-extrabold tracking-tight text-ink">Your estimate</Text>
              <Text className="text-sm text-muted">Not a fixed catalogue total: your agent bargains real prices at {market.name}.</Text>
            </View>
            <Card>
              <SectionHeader title="Your list" subtitle="What your agent will shop for." />
              {filled.map((r, i) => (
                <View key={i} className="flex-row items-center gap-3 border-t border-dashed border-line-strong py-2.5">
                  <ItemArt name={r.item} />
                  <Text className="flex-1 text-sm font-semibold text-ink" numberOfLines={1}>
                    {r.item.trim()}
                    {Number(r.qty) >= 1 ? <Text className="text-xs text-faint"> ×{r.qty}</Text> : null}
                  </Text>
                  <Text className={Number(r.price) > 0 ? 'text-sm font-bold text-ink' : 'text-xs font-semibold text-faint'}>{Number(r.price) > 0 ? naira(r.price) : 'from budget'}</Text>
                </View>
              ))}
            </Card>
            <Card>
              <SectionHeader title="Estimate" />
              <View className="flex-row justify-between"><Text className="text-muted">Goods estimate</Text><Text className="font-semibold text-ink">{naira(goodsTotal)}</Text></View>
              <View className="flex-row justify-between"><Text className="text-muted">Delivery quote</Text><Text className="font-semibold text-ink">{naira(pricing.deliveryFee)}</Text></View>
              <Text className="text-xs text-faint">
                Plus a {+(pricing.serviceFeeRate * 100).toFixed(1)}% service fee on what&apos;s actually bought (about {naira(serviceFee)} on this estimate).
              </Text>
              {deposit > 0 ? (
                <View className="rounded-2xl bg-brand-orange/[0.12] px-3 py-3">
                  <Text className="text-sm text-ink/80">
                    {`A ${Math.round(pricing.depositRate * 100)}% deposit (${naira(deposit)}) is required before shopping can start.`}
                  </Text>
                </View>
              ) : null}
              <Text className="text-xs text-faint">Delivering to: {address}</Text>
              <Button label="Get my quote" onPress={place} />
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
