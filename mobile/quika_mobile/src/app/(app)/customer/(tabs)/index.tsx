import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PROBLEM, Progress, look } from '@/components/customer/orderLook';
import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import SegmentedToggle from '@/components/SegmentedToggle';
import { Text } from '@/components/Text';
import { Button, Float, SafeAreaView, StatusBadge } from '@/components/ui';
import { ago, naira, shortId } from '@/lib/format';
import { useMarkets } from '@/lib/catalog';
import { orderStore, useOrderState } from '@/lib/orderStore';
import { ON_THE_MOVE, isHistory, summarize } from '@/lib/orderStatus';

type Filter = 'active' | 'history';

const CLOCK = ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M12 6v6l4 2'];
const CHECK = ['M20 6 9 17l-5-5'];

export default function Track() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('active');

  const { orders, loaded, error } = useOrderState();
  const { markets } = useMarkets();
  const marketName = (id: string) => markets.find((m) => m.id === id)?.name;
  const sorted = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const active = sorted.filter((o) => !isHistory(o.status));
  const past = sorted.filter((o) => isHistory(o.status));
  const shown = filter === 'active' ? active : past;
  const busy = active.length > 0;
  const moving = active.filter((o) => ON_THE_MOVE.has(o.status)).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-3" showsVerticalScrollIndicator={false}>
        {loaded && !error && orders.length === 0 ? (
          <>
            <View className="items-center gap-2">
              <Animated.View entering={FadeInDown.duration(500)}>
                <Float>
                  <Image source={require('../../../../../assets/illustrations/track.webp')} resizeMode="contain" style={{ width: 190, height: 140 }} />
                </Float>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center gap-2">
                <Text className="text-center text-[30px] font-extrabold leading-[36px] tracking-tight text-ink">
                  Nothing in{'\n'}
                  <Text className="text-[30px] font-extrabold leading-[36px] tracking-tight text-brand-orange-dark">progress</Text>
                </Text>
                <Text className="max-w-[300px] text-center text-base leading-6 text-muted">Orders you place show up here so you can follow them to your door.</Text>
              </Animated.View>
            </View>
            <Button label="Start a new order" onPress={() => router.push('/customer/new-order')} />
          </>
        ) : (
          <PageHeader
            top="Your"
            accent="orders"
            subtitle={busy ? `${active.length} active${moving > 0 ? ` · ${moving} on the way` : ''}` : 'Nothing in progress right now'}
            right={
              <Pressable
                onPress={() => router.push('/customer/new-order')}
                accessibilityRole="button"
                accessibilityLabel="Start a new order"
                className="flex-row items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2.5 active:bg-brand-orange-dark">
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth={3} strokeLinecap="round">
                  <Path d="M12 5v14M5 12h14" />
                </Svg>
                <Text className="text-sm font-bold text-ink">New</Text>
              </Pressable>
            }
          />
        )}

        {!loaded ? <Text className="text-center text-sm text-muted">Loading your orders…</Text> : null}
        {error ? (
          <View className="items-center gap-2 rounded-3xl border border-line bg-surface p-4">
            <Text className="text-center text-sm font-semibold text-red-700">{error}</Text>
            <Button label="Try again" variant="outline" onPress={() => void orderStore.refresh()} />
          </View>
        ) : null}

        <SegmentedToggle
          value={filter}
          onChange={setFilter}
          segments={[
            { id: 'active', label: 'Active', icon: CLOCK, count: active.length },
            { id: 'history', label: 'History', icon: CHECK, count: past.length },
          ]}
        />

        {shown.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} className="items-center gap-1 rounded-3xl border border-line bg-surface px-6 py-8">
            <Image
              source={filter === 'active' ? require('../../../../../assets/illustrations/track.webp') : require('../../../../../assets/illustrations/history.webp')}
              resizeMode="contain"
              className="h-24 w-32"
            />
            <Text className="mt-1 text-base font-bold text-ink">{filter === 'active' ? 'No active orders' : 'No past orders yet'}</Text>
            <Text className="text-center text-sm text-muted">{filter === 'active' ? 'Orders you place show up here.' : 'Delivered and cancelled orders land here.'}</Text>
          </Animated.View>
        ) : null}

        {shown.map((o, i) => {
          const { art, tint } = look(o);
          const market = marketName(o.market_id);
          const live = filter === 'active' && !PROBLEM.has(o.status);
          return (
            <Animated.View key={o.id} entering={FadeInDown.delay(i * 80).duration(450)}>
              <Pressable
                onPress={() => router.push(`/customer/orders/${o.id}`)}
                className="gap-3 overflow-hidden rounded-3xl border border-line bg-surface p-4 shadow-sm active:bg-surface-2"
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <View className="flex-row items-center gap-4">
                  <View className={`h-[84px] w-[84px] items-center justify-center rounded-2xl ${tint}`}>
                    <Image source={art} resizeMode="contain" className="h-[68px] w-[68px]" />
                  </View>
                  <View className="flex-1 gap-1.5">
                    <View className="flex-row items-center justify-between gap-2">
                      <StatusBadge status={o.status} />
                      <Text className="text-xs text-faint">{ago(o.created_at)}</Text>
                    </View>
                    <Text className="text-base font-extrabold leading-5 tracking-tight text-ink" numberOfLines={2}>
                      {summarize(o, market)}
                    </Text>
                  </View>
                  <Text className="text-2xl text-brand-orange-dark">›</Text>
                </View>
                {live ? <Progress status={o.status} labels={i === 0} /> : null}
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm text-muted" numberOfLines={1}>
                    {market || 'Market'} · {o.items.length} item{o.items.length === 1 ? '' : 's'} · #{shortId(o.id)}
                  </Text>
                  {Number(o.grand_total) > 0 ? <Text className="text-sm font-bold text-ink">{naira(o.grand_total)}</Text> : null}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
