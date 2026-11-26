import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View, type ImageSourcePropType } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Text } from '@/components/Text';

import PageHeader from '@/components/PageHeader';
import SegmentedToggle from '@/components/SegmentedToggle';
import OrderBackdrop from '@/components/customer/OrderBackdrop';
import FlowSteps, { type FlowStepKey } from '@/components/customer/FlowSteps';
import { Button, Card, Field, Float, ItemArt, SafeAreaView, SectionHeader } from '@/components/ui';
import { naira } from '@/lib/format';
import { parseListLine } from '@/lib/parseListLine';
import { api } from '@/lib/api';
import { clock, marketOpenNow, useMarkets, usePricing } from '@/lib/catalog';
import { orderStore } from '@/lib/orderStore';
import { useSession } from '@/lib/session';
import type { Market } from '@/lib/types';

const MIN_ADDRESS = 8;

type Row = { item: string; price: string; qty: string; note: string };
const blank = (): Row => ({ item: '', price: '', qty: '', note: '' });

const PENCIL = ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z', 'm15 5 4 4'];
const LIST = ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'];

// Each step opens with an illustration and a two-tone headline, like the intro and welcome pages.
const COPY: Record<FlowStepKey, { art: ImageSourcePropType; top: string; accent: string }> = {
  list: { art: require('../../../../../assets/illustrations/person-shopping-list.webp'), top: 'What do you need', accent: 'from the market?' },
  market: { art: require('../../../../../assets/illustrations/market-stall-produce.webp'), top: 'Pick your', accent: 'market' },
  address: { art: require('../../../../../assets/illustrations/delivery-map-route.webp'), top: 'Where should we', accent: 'deliver?' },
  quote: { art: require('../../../../../assets/illustrations/grocery-basket.webp'), top: "Here's your", accent: 'estimate' },
};
const MARKET_TILES: { art: ImageSourcePropType; tint: string }[] = [
  { art: require('../../../../../assets/illustrations/market-stall-produce.webp'), tint: 'bg-brand-orange/15' },
  { art: require('../../../../../assets/illustrations/market-cart-vendor.webp'), tint: 'bg-brand-green/15' },
  { art: require('../../../../../assets/illustrations/vendor-stall-pantry-jars.webp'), tint: 'bg-gold/40' },
];

// The same four steps as the web: your list, the market, where to deliver,
// then the estimate. State lives here so going back never loses anything.
export default function NewOrder() {
  const router = useRouter();
  const { user } = useSession();
  const pricing = usePricing();
  const { markets, loading: marketsLoading, error: marketsError, retry: retryMarkets } = useMarkets();

  const [step, setStep] = useState<FlowStepKey>('list');
  const [mode, setMode] = useState<'freetext' | 'detailed'>('freetext');
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [budget, setBudget] = useState('');
  const [market, setMarket] = useState<Market | null>(null);
  const [query, setQuery] = useState('');
  const [address, setAddress] = useState(user?.default_delivery_address ?? '');
  const [placing, setPlacing] = useState(false);
  const [problem, setProblem] = useState('');

  // Free-text: one item per line, read the way the web does ("3 packs of milk 2000").
  const parsedLines = useMemo(
    () =>
      text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map(parseListLine),
    [text],
  );
  const entries: Row[] =
    mode === 'freetext'
      ? parsedLines.map((p) => ({ item: p.description, price: p.price != null ? String(p.price) : '', qty: p.quantity != null ? String(p.quantity) : '', note: '' }))
      : rows;
  const filled = entries.filter((r) => r.item.trim());
  const priced = filled.filter((r) => Number(r.price) > 0);
  const unpriced = filled.filter((r) => !(Number(r.price) > 0));
  const budgetTotal = unpriced.length > 0 ? Number(budget) || 0 : 0;
  const goodsTotal = priced.reduce((s, r) => s + Number(r.price), 0) + budgetTotal;

  const serviceFee = goodsTotal * pricing.serviceFeeRate;
  const deposit = goodsTotal * pricing.depositRate;

  const shownMarkets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markets.filter((m) => !q || [m.name, m.city, m.state].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [query, markets]);

  const setRow = (i: number, patch: Partial<Row>) => setRows((cur) => cur.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  // Sends the order to the server, which checks the market is open and works out the deposit. The deposit is paid on the order page.
  const place = async () => {
    if (!market) return setStep('market');
    if (filled.length === 0) return setStep('list');
    if (address.trim().length < MIN_ADDRESS) return setStep('address');
    setPlacing(true);
    setProblem('');
    try {
      const placed = await api.createOrder({
        market_id: market.id,
        delivery_address: address.trim(),
        // The budget for items with no price of their own; priced items carry theirs.
        listed_items_total: budgetTotal.toFixed(2),
        items: filled.map((r) => ({
          description: r.item.trim(),
          ...(Number(r.price) > 0 ? { listed_price: Number(r.price).toFixed(2) } : {}),
          ...(Number(r.qty) >= 1 ? { quantity: Number(r.qty) } : {}),
          ...(r.note.trim() ? { requested_note: r.note.trim() } : {}),
        })),
      });
      orderStore.upsert(placed);
      // Start the next order from a clean slate, then open this one.
      setStep('list');
      setText('');
      setRows([blank()]);
      setBudget('');
      setMarket(null);
      router.push(`/customer/orders/${placed.id}`);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setPlacing(false);
    }
  };

  const SUB: Record<FlowStepKey, string> = {
    list: "Write it the way you'd tell someone: the item, and roughly what you expect to pay.",
    market: 'Where should your agent shop your list?',
    address: `We'll deliver your haul from ${market?.name || 'the market'} to your door.`,
    quote: `Not a fixed catalogue total: your agent bargains real prices at ${market?.name || 'the market'}.`,
  };
  const copy = COPY[step];
  const goTo = (to: FlowStepKey) => {
    setProblem('');
    setStep(to);
  };
  const back = () => goTo(step === 'quote' ? 'address' : step === 'address' ? 'market' : 'list');

  const Top = (
    <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
      {step !== 'list' ? (
        <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
          <Text className="text-2xl text-ink">‹</Text>
        </Pressable>
      ) : (
        <View className="h-11 w-11" />
      )}
      <FlowSteps current={step} onStepClick={goTo} />
      <View className="h-11 w-11" />
    </Animated.View>
  );

  const Hero = (
    <View key={step} className="items-center gap-2">
      <Animated.View entering={FadeInDown.duration(500)}>
        <Float>
          <Image source={copy.art} resizeMode="contain" style={{ width: 190, height: 140 }} />
        </Float>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center gap-2">
        <Text className="text-center text-[30px] font-extrabold leading-[36px] tracking-tight text-ink">
          {copy.top}
          {'\n'}
          <Text className="text-[30px] font-extrabold leading-[36px] tracking-tight text-brand-orange-dark">{copy.accent}</Text>
        </Text>
        <Text className="max-w-[300px] text-center text-base leading-6 text-muted">{SUB[step]}</Text>
        {market && step !== 'market' ? (
          <Pressable onPress={() => setStep('market')} className="mt-1 rounded-full border border-line-strong bg-surface px-3.5 py-1.5">
            <Text className="text-xs font-bold text-ink">
              Shopping at {market.name} <Text className="font-semibold text-brand-orange-dark">· change</Text>
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );

  const CompactHero = (
    <View key={step} className="gap-3">
      <PageHeader top={copy.top} accent={copy.accent} subtitle={SUB[step]} art={copy.art} />
      {market && step !== 'market' ? (
        <Pressable onPress={() => setStep('market')} className="self-start rounded-full border border-line-strong bg-surface px-3.5 py-1.5">
          <Text className="text-xs font-bold text-ink">
            Shopping at {market.name} <Text className="font-semibold text-brand-orange-dark">· change</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {Top}
        {step === 'list' ? Hero : CompactHero}

        {step === 'list' ? (
          <>
            <SegmentedToggle
              value={mode}
              onChange={setMode}
              segments={[
                { id: 'freetext', label: 'Free-text', icon: PENCIL, count: parsedLines.length },
                { id: 'detailed', label: 'Detailed', icon: LIST, count: rows.filter((r) => r.item.trim()).length },
              ]}
            />

            {mode === 'freetext' ? (
              <>
                <Card>
                  <Text className="text-sm text-muted">
                    Type or paste one item per line, like <Text className="font-semibold text-ink">&quot;3 packs of milk 2000&quot;</Text>. We pick up the price and quantity for you.
                  </Text>
                  <Field
                    multiline
                    value={text}
                    onChangeText={setText}
                    placeholder={'3 packs of milk 2000\nPepper 1500\nOnions\nTomatoes ₦800'}
                    textAlignVertical="top"
                    autoCapitalize="sentences"
                    className="min-h-[180px]"
                  />
                </Card>
                {parsedLines.length > 0 ? (
                  <Card>
                    <Text className="text-xs font-bold uppercase tracking-wide text-faint">We read it as</Text>
                    {parsedLines.map((p, i) => (
                      <View key={i} className="flex-row items-center gap-3 py-1">
                        <ItemArt name={p.description} />
                        <Text className="flex-1 text-sm font-semibold text-ink" numberOfLines={1}>
                          {p.description}
                          {p.quantity != null ? <Text className="text-xs text-faint"> ×{p.quantity}</Text> : null}
                        </Text>
                        <Text className={p.price != null ? 'text-sm font-bold text-brand-army' : 'text-xs font-semibold text-faint'}>{p.price != null ? naira(p.price) : 'no price'}</Text>
                      </View>
                    ))}
                  </Card>
                ) : null}
              </>
            ) : (
              <>
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
            <Button
                  label="Add another item"
                  variant="outline"
                  onPress={() => setRows((cur) => [...cur, blank()])}
                  icon={
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-orange">
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth={2.75} strokeLinecap="round">
                        <Path d="M12 5v14M5 12h14" />
                      </Svg>
                    </View>
                  }
                />
              </>
            )}

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
              {problem ? <Text className="text-center text-sm font-semibold text-red-700">{problem}</Text> : null}
              <Button
                label="Continue"
                onPress={() => {
                  if (filled.length === 0) return setProblem('Add at least one item to your list first.');
                  setProblem('');
                  setStep(market ? 'address' : 'market');
                }}
              />
            </Card>
          </>
        ) : null}

        {step === 'market' ? (
          <>
            <Field placeholder="Search markets" value={query} onChangeText={setQuery} autoCapitalize="none" />
            {marketsLoading ? <Text className="text-center text-muted">Loading markets…</Text> : null}
            {marketsError ? (
              <View className="items-center gap-2 rounded-3xl border border-line bg-surface p-5">
                <Text className="text-center text-sm font-semibold text-red-700">{marketsError}</Text>
                <Button label="Try again" variant="outline" onPress={retryMarkets} />
              </View>
            ) : null}
            {!marketsLoading && !marketsError && shownMarkets.length === 0 ? <Text className="text-muted">No markets match your search.</Text> : null}
            {shownMarkets.map((m, i) => {
              const selected = market?.id === m.id;
              const tile = MARKET_TILES[i % MARKET_TILES.length];
              const open = marketOpenNow(m);
              return (
                <Animated.View key={m.id} entering={FadeInDown.delay(i * 90).duration(450)}>
                  <Pressable
                    disabled={!open}
                    onPress={() => {
                      setMarket(m);
                      setStep('address');
                    }}
                    className={'flex-row items-center gap-4 overflow-hidden rounded-3xl bg-surface p-4 shadow-sm active:bg-surface-2 ' + (selected ? 'border-2 border-brand-orange' : 'border border-line') + (open ? '' : ' opacity-60')}
                    style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                    <View className={`h-[84px] w-[84px] items-center justify-center rounded-2xl ${tile.tint}`}>
                      <Image source={tile.art} resizeMode="contain" className="h-[68px] w-[68px]" />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-lg font-extrabold tracking-tight text-ink">{m.name}</Text>
                      <Text className="text-sm font-semibold text-brand-orange-dark">{[m.city, m.state].filter(Boolean).join(', ')}</Text>
                      <Text className={'text-xs font-bold ' + (open ? 'text-brand-army' : 'text-red-700')}>{open ? `Open until ${clock(m.closing_time)}` : `Closed · opens ${clock(m.opening_time)}`}</Text>
                      {m.description ? <Text className="text-sm leading-5 text-muted" numberOfLines={2}>{m.description}</Text> : null}
                    </View>
                    <Text className="text-2xl text-brand-orange-dark">›</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </>
        ) : null}

        {step === 'address' ? (
          <>
            {user?.default_delivery_address && address !== user.default_delivery_address ? (
              <Pressable onPress={() => setAddress(user.default_delivery_address!)} className="rounded-2xl bg-sunken px-4 py-3">
                <Text className="text-xs font-bold uppercase tracking-wide text-faint">Saved address</Text>
                <Text className="font-semibold text-ink">{user.default_delivery_address}</Text>
              </Pressable>
            ) : null}
            <Field placeholder="Street, area, landmark" value={address} onChangeText={setAddress} multiline className="min-h-[88px]" />
            <Text className="text-xs text-faint">Include a landmark or gate colour. It helps the rider find you.</Text>
            {problem ? <Text className="text-sm font-semibold text-red-700">{problem}</Text> : null}
            <Button
              label="Continue"
              onPress={() => {
                if (address.trim().length < MIN_ADDRESS) return setProblem('Enter the street and area, so your rider can find you.');
                setProblem('');
                setStep('quote');
              }}
            />
          </>
        ) : null}

        {step === 'quote' && market ? (
          <>
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
              <View className="items-center py-2">
                <Text className="text-sm font-semibold text-muted">Estimated total</Text>
                <Text className="text-[40px] font-extrabold leading-[46px] tracking-tight text-ink">{naira(goodsTotal + pricing.deliveryFee)}</Text>
                <Text className="text-xs text-faint">goods + delivery, before the service fee</Text>
              </View>
              <View className="my-1 h-px bg-line-strong" />
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
              {problem ? <Text className="text-center text-sm font-semibold text-red-700">{problem}</Text> : null}
              <Button label="Place my order" busy={placing} onPress={place} />
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
