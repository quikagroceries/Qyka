import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import StatTiles from '@/components/StatTiles';
import { Text } from '@/components/Text';
import { Float, SafeAreaView, StatusBadge } from '@/components/ui';
import { shortId } from '@/lib/format';
import { ORDERS, marketName } from '@/lib/mock';
import type { AgentOrder } from '@/lib/types';

const readyToShop = (o: AgentOrder) => o.status === 'agent_assigned';
const inProgress = (o: AgentOrder) => o.status === 'shopping';
const needsDrop = (o: AgentOrder) => o.status === 'paid';
const needsAttention = (o: AgentOrder) => o.status === 'cancelled_unpaid';

type Tone = 'ready' | 'progress' | 'drop' | 'attention';

// Each kind of task gets its own illustration tile, like the order cards on the customer side.
const LOOK: Record<Tone, { art: ImageSourcePropType; tint: string; cta?: string }> = {
  ready: { art: require('../../../../../assets/illustrations/market-cart-vendor.webp'), tint: 'bg-brand-orange/15', cta: 'Start shopping' },
  progress: { art: require('../../../../../assets/illustrations/shopping-cart.webp'), tint: 'bg-gold/40', cta: 'Keep shopping' },
  drop: { art: require('../../../../../assets/illustrations/map-pin-storefront.webp'), tint: 'bg-gold/40', cta: 'Take to the hub' },
  attention: { art: require('../../../../../assets/illustrations/market-stall-produce.webp'), tint: 'bg-red-50' },
};

function TaskCard({ order, market, tone, index, onOpen }: { order: AgentOrder; market?: string; tone: Tone; index: number; onOpen: () => void }) {
  const n = order.items?.length ?? 0;
  const look = LOOK[tone];
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(450)}>
      <Pressable
        onPress={onOpen}
        className={'gap-3 rounded-3xl bg-surface p-4 shadow-sm active:bg-surface-2 ' + (tone === 'attention' ? 'border-2 border-red-300' : tone === 'ready' ? 'border-2 border-brand-orange/60' : 'border border-line')}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View className="flex-row items-center gap-4">
          <View className={`h-[84px] w-[84px] items-center justify-center rounded-2xl ${look.tint}`}>
            <Image source={look.art} resizeMode="contain" className="h-[68px] w-[68px]" />
          </View>
          <View className="flex-1 gap-1.5">
            <View className="flex-row items-center justify-between gap-2">
              <StatusBadge status={order.status} />
              <Text className="text-xs text-faint">#{shortId(order.id)}</Text>
            </View>
            <Text className="text-lg font-extrabold leading-6 tracking-tight text-ink" numberOfLines={1}>
              {market || 'Market'}
            </Text>
            <Text className="text-sm text-muted">
              {n} item{n === 1 ? '' : 's'}
            </Text>
          </View>
          <Text className="text-2xl text-brand-orange-dark">›</Text>
        </View>
        {tone === 'attention' ? (
          <View className="rounded-2xl bg-red-50 px-3 py-2.5">
            <Text className="text-sm font-semibold text-red-700">Balance wasn&apos;t paid. Please return these goods to the market or vendor.</Text>
          </View>
        ) : look.cta ? (
          <Text className="text-sm font-bold text-brand-orange-dark">{look.cta} ›</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export default function AgentHome() {
  const router = useRouter();
  const orders = ORDERS.filter((o) => o.agent_id);

  const drop = orders.filter(needsDrop);
  const ready = orders.filter(readyToShop);
  const going = orders.filter(inProgress);
  const attention = orders.filter(needsAttention);
  const actionable = drop.length + ready.length + going.length;

  const title =
    attention.length > 0
      ? 'Something needs your attention'
      : drop.length > 0
        ? 'Goods are waiting to go to the hub'
        : ready.length > 0
          ? 'A list is waiting for you'
          : going.length > 0
            ? "You're mid-run. Keep going."
            : 'All clear for now';

  const section = (heading: string, subtitle: string, list: AgentOrder[], tone: Tone) =>
    list.length === 0 ? null : (
      <View className="gap-3">
        <View className="gap-0.5">
          <Text className="text-lg font-extrabold tracking-tight text-ink">{heading}</Text>
          <Text className="text-sm leading-5 text-muted">{subtitle}</Text>
        </View>
        {list.map((o, i) => (
          <TaskCard key={o.id} order={o} tone={tone} index={i} market={marketName(o.market_id)} onOpen={() => router.push(`/agent/orders/${o.id}`)} />
        ))}
      </View>
    );

  const empty = actionable === 0 && attention.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-3" showsVerticalScrollIndicator={false}>
        {empty ? (
          <View className="items-center gap-2">
            <Animated.View entering={FadeInDown.duration(500)}>
              <Float>
                <Image source={require('../../../../../assets/illustrations/shopping-cart.webp')} resizeMode="contain" style={{ width: 190, height: 140 }} />
              </Float>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center gap-2">
              <Text className="text-center text-[30px] font-extrabold leading-[36px] tracking-tight text-ink">
                No tasks{'\n'}
                <Text className="text-[30px] font-extrabold leading-[36px] tracking-tight text-brand-orange-dark">right now</Text>
              </Text>
              <Text className="max-w-[300px] text-center text-base leading-6 text-muted">New assignments will show up here.</Text>
            </Animated.View>
          </View>
        ) : (
          <>
            <PageHeader top="Your" accent="tasks" subtitle={title} art={require('../../../../../assets/illustrations/market-cart-vendor.webp')} />

            <StatTiles
              delay={80}
              items={[
                { value: drop.length, label: 'To hub', art: require('../../../../../assets/illustrations/map-pin-storefront.webp'), tint: 'bg-gold/40', hot: drop.length > 0 },
                { value: ready.length, label: 'Ready', art: require('../../../../../assets/illustrations/market-cart-vendor.webp'), tint: 'bg-brand-orange/15', hot: ready.length > 0 },
                { value: going.length, label: 'Shopping', art: require('../../../../../assets/illustrations/shopping-cart.webp'), tint: 'bg-brand-green/15', hot: going.length > 0 },
              ]}
            />
          </>
        )}

        {section('Needs attention', "The customer didn't pay the balance in time. The deposit is forfeited. Return the goods you already bought.", attention, 'attention')}
        {section('Take to the hub', 'Paid and bought. Drop these at the hub in the market.', drop, 'drop')}
        {section('Ready to shop', 'Start shopping now.', ready, 'ready')}
        {section('In progress', "You're actively shopping these.", going, 'progress')}
      </ScrollView>
    </SafeAreaView>
  );
}
