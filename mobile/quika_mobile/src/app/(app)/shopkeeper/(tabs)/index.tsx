import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import StatTiles from '@/components/StatTiles';
import { Text } from '@/components/Text';
import { Float, SafeAreaView } from '@/components/ui';
import { ago, clockTime, shortId } from '@/lib/format';
import { useHub } from '@/lib/hubStore';
import type { HubOrder } from '@/lib/types';

// The queue is three lanes in the order work happens at the hub: check what
// the agent brought, bag it, hand it to the rider who comes.
const LANES: { status: string; title: string; subtitle: string; hint: string; art: ImageSourcePropType; tint: string }[] = [
  { status: 'paid', title: 'On the way', subtitle: 'Agents carrying goods to your hub.', hint: 'Waiting for the agent', art: require('../../../../../assets/illustrations/shopping-cart.webp'), tint: 'bg-sunken' },
  { status: 'dropped_at_hub', title: 'Just dropped', subtitle: 'Check what the agent brought against the list.', hint: 'Check in', art: require('../../../../../assets/illustrations/market-cart-vendor.webp'), tint: 'bg-brand-orange/15' },
  { status: 'received_by_hub', title: 'Checked in', subtitle: 'Bag it up and mark it ready for a rider.', hint: 'Mark ready', art: require('../../../../../assets/illustrations/produce-crate.webp'), tint: 'bg-gold/40' },
  { status: 'ready_for_pickup', title: 'Ready for riders', subtitle: 'A rider will show you a code when they arrive.', hint: 'Waiting for a rider', art: require('../../../../../assets/illustrations/rider-bicycle.webp'), tint: 'bg-brand-green/15' },
];

function OrderCard({ order, lane, index, onOpen }: { order: HubOrder; lane: (typeof LANES)[number]; index: number; onOpen: () => void }) {
  const waiting = order.rider_waiting;
  const n = order.items.length;
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(450)}>
      <Pressable
        onPress={onOpen}
        className={'gap-3 rounded-3xl bg-surface p-4 shadow-sm active:bg-surface-2 ' + (waiting ? 'border-2 border-brand-orange/60' : 'border border-line')}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View className="flex-row items-center gap-4">
          <View className={`h-[84px] w-[84px] items-center justify-center rounded-2xl ${lane.tint}`}>
            <Image source={lane.art} resizeMode="contain" className="h-[68px] w-[68px]" />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-xs text-faint">{order.hub_received_at ? `Checked in ${ago(order.hub_received_at)}` : order.dropped_at_hub_at ? `Dropped ${ago(order.dropped_at_hub_at)}` : 'On its way to the hub'}</Text>
            <Text className="text-lg font-extrabold tracking-wide text-ink">#{shortId(order.id)}</Text>
            <Text className="text-sm text-muted" numberOfLines={1}>
              {n} item{n === 1 ? '' : 's'}
              {order.agent_name ? ` · from ${order.agent_name}` : ''}
            </Text>
          </View>
          <Text className="text-2xl text-brand-orange-dark">›</Text>
        </View>
        {waiting ? (
          <View className="rounded-2xl bg-brand-orange/15 px-3 py-2.5">
            <Text className="text-sm font-bold text-brand-orange-dark">{order.rider_name || 'A rider'} is here: enter their code ›</Text>
          </View>
        ) : (
          <Text className="text-sm font-bold text-brand-orange-dark">{lane.hint} ›</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function HubHome() {
  const router = useRouter();
  const { orders, handed } = useHub();
  // Tap a tile to show only that lane (tap it again for all); tap a lane's heading to fold it away.
  const [only, setOnly] = useState<string | null>(null);
  const [folded, setFolded] = useState<string[]>([]);
  const pick = (status: string) => setOnly((cur) => (cur === status ? null : status));

  const byStatus = (s: string) => orders.filter((o) => o.status === s);
  const toCheckIn = byStatus('dropped_at_hub').length;
  const checkedIn = byStatus('received_by_hub').length;
  const ready = byStatus('ready_for_pickup').length;
  const incoming = byStatus('paid').length;
  const waitingRiders = orders.filter((o) => o.rider_waiting && o.status === 'ready_for_pickup');
  const riderWaiting = waitingRiders.length;

  let subtitle = 'Orders agents drop off show up here.';
  if (riderWaiting > 0) subtitle = `${riderWaiting} rider${riderWaiting === 1 ? ' is' : 's are'} waiting. Open the order and enter their code.`;
  else if (toCheckIn > 0) subtitle = `${toCheckIn} to check in. An agent has dropped goods off.`;
  else if (incoming > 0) subtitle = `${incoming} on the way to you. Nothing to do until it arrives.`;
  else if (orders.length > 0) subtitle = 'Nothing needs you right now. Everything is waiting for a rider.';

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-3" showsVerticalScrollIndicator={false}>
        {orders.length === 0 ? (
          <View className="items-center gap-2">
            <Animated.View entering={FadeInDown.duration(500)}>
              <Float>
                <Image source={require('../../../../../assets/illustrations/produce-crate.webp')} resizeMode="contain" style={{ width: 190, height: 140 }} />
              </Float>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center gap-2">
              <Text className="text-center text-[30px] font-extrabold leading-[36px] tracking-tight text-ink">
                No orders{'\n'}
                <Text className="text-[30px] font-extrabold leading-[36px] tracking-tight text-brand-orange-dark">at your hub</Text>
              </Text>
              <Text className="max-w-[300px] text-center text-base leading-6 text-muted">When an agent drops an order off, it lands here.</Text>
            </Animated.View>
          </View>
        ) : (
          <>
            <PageHeader top="Your" accent="hub" subtitle={subtitle} art={require('../../../../../assets/illustrations/map-pin-storefront.webp')} />
            <StatTiles
              delay={80}
              items={[
                { value: incoming, label: 'On the way', art: require('../../../../../assets/illustrations/shopping-cart.webp'), tint: 'bg-sunken', onPress: () => pick('paid'), selected: only === 'paid' },
                { value: toCheckIn, label: 'Dropped', art: require('../../../../../assets/illustrations/market-cart-vendor.webp'), tint: 'bg-brand-orange/15', hot: toCheckIn > 0, onPress: () => pick('dropped_at_hub'), selected: only === 'dropped_at_hub' },
                { value: checkedIn, label: 'Checked in', art: require('../../../../../assets/illustrations/produce-crate.webp'), tint: 'bg-gold/40', hot: checkedIn > 0, onPress: () => pick('received_by_hub'), selected: only === 'received_by_hub' },
                { value: ready, label: 'Ready', art: require('../../../../../assets/illustrations/rider-bicycle.webp'), tint: 'bg-brand-green/15', hot: riderWaiting > 0, onPress: () => pick('ready_for_pickup'), selected: only === 'ready_for_pickup' },
              ]}
            />
          </>
        )}
        {waitingRiders.map((o) => (
          <Animated.View key={o.id} entering={FadeInDown.duration(450)}>
            <Pressable
              onPress={() => router.push(`/shopkeeper/orders/${o.id}`)}
              className="flex-row items-center gap-3 rounded-3xl bg-brand-orange px-5 py-4 active:bg-brand-orange-dark"
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase tracking-wide text-ink/70">Rider is here</Text>
                <Text className="text-lg font-extrabold tracking-tight text-ink">{o.rider_name || 'A rider'} for #{shortId(o.id)}</Text>
                <Text className="text-sm text-ink/80">Tap to enter their code and hand over</Text>
              </View>
              <Text className="text-3xl text-ink">›</Text>
            </Pressable>
          </Animated.View>
        ))}

        {LANES.filter((lane) => !only || lane.status === only).map((lane) => {
          const list = byStatus(lane.status);
          if (list.length === 0) {
            return only ? (
              <View key={lane.status} className="items-center gap-1 rounded-3xl border border-line bg-surface px-6 py-8">
                <Text className="text-base font-bold text-ink">Nothing in “{lane.title}”</Text>
                <Text className="text-center text-sm text-muted">{lane.subtitle}</Text>
                <Pressable onPress={() => setOnly(null)} hitSlop={8} className="mt-2">
                  <Text className="text-sm font-bold text-brand-orange-dark">Show everything</Text>
                </Pressable>
              </View>
            ) : null;
          }
          // Riders who are already standing there go first.
          const sorted = [...list].sort((a, b) => Number(b.rider_waiting) - Number(a.rider_waiting));
          const isFolded = folded.includes(lane.status);
          return (
            <View key={lane.status} className="gap-3">
              <Pressable
                onPress={() => setFolded((cur) => (cur.includes(lane.status) ? cur.filter((x) => x !== lane.status) : [...cur, lane.status]))}
                accessibilityRole="button"
                accessibilityState={{ expanded: !isFolded }}
                className="flex-row items-center justify-between gap-3 active:opacity-70">
                <View className="flex-1 gap-0.5">
                  <Text className="text-lg font-extrabold tracking-tight text-ink">
                    {lane.title} <Text className="text-lg font-extrabold text-brand-orange-dark">{list.length}</Text>
                  </Text>
                  <Text className="text-sm leading-5 text-muted">{lane.subtitle}</Text>
                </View>
                <Text className="text-xl text-brand-orange-dark">{isFolded ? '▸' : '▾'}</Text>
              </Pressable>
              {isFolded ? null : sorted.map((o, i) => <OrderCard key={o.id} order={o} lane={lane} index={i} onOpen={() => router.push(`/shopkeeper/orders/${o.id}`)} />)}
            </View>
          );
        })}

        {handed.length > 0 && !only ? (
          <View className="gap-3">
            <View className="gap-0.5">
              <Text className="text-lg font-extrabold tracking-tight text-ink">Handed over</Text>
              <Text className="text-sm text-muted">Out for delivery. Your fee lands once each customer confirms.</Text>
            </View>
            <View className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
              {handed.map((h, i) => (
                <View key={h.id} className={'flex-row items-center gap-3 px-4 py-3.5 ' + (i > 0 ? 'border-t border-dashed border-line-strong' : '')}>
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/15">
                    <Text className="text-base font-extrabold text-brand-army">✓</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">#{shortId(h.id)}</Text>
                    <Text className="text-xs text-muted">To {h.rider}</Text>
                  </View>
                  <Text className="text-xs font-semibold text-muted">{clockTime(h.at)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
