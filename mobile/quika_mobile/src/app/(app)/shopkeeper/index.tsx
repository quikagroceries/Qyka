import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import { Card, EmptyState, ErrorBanner, Hero, SafeAreaView, SectionHeader } from '@/components/ui';
import { api, type HubOrder } from '@/lib/api';
import { ago, errMsg, shortId } from '@/lib/format';
import { usePolling } from '@/lib/usePolling';

// The queue is three lanes in the order work happens at the hub: check what
// the agent brought, bag it, hand it to the rider who comes.
const LANES = [
  { status: 'dropped_at_hub', title: 'Just dropped', subtitle: 'Check what the agent brought against the list.', hint: 'Check in' },
  { status: 'received_by_hub', title: 'Checked in', subtitle: 'Bag it up and mark it ready for a rider.', hint: 'Mark ready' },
  { status: 'ready_for_pickup', title: 'Ready for riders', subtitle: 'A rider will show you a code when they arrive.', hint: 'Waiting for a rider' },
];

function OrderCard({ order, hint, onOpen }: { order: HubOrder; hint: string; onOpen: () => void }) {
  const waiting = order.rider_waiting;
  const n = order.items.length;
  return (
    <Pressable onPress={onOpen} className="active:opacity-80">
      <Card accent={waiting}>
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-lg font-extrabold tracking-wide text-ink">#{shortId(order.id)}</Text>
          <Text className="text-xs text-faint">
            {order.hub_received_at ? `Checked in ${ago(order.hub_received_at)}` : `Dropped ${ago(order.dropped_at_hub_at)}`}
          </Text>
        </View>
        <Text className="text-muted">
          {n} item{n === 1 ? '' : 's'}
          {order.agent_name ? ` · from ${order.agent_name}` : ''}
        </Text>
        <Text className={'mt-1 text-sm font-bold ' + (waiting ? 'text-brand-orange-dark' : 'text-ink/70')}>
          {waiting ? `${order.rider_name || 'A rider'} is here: enter their code` : hint}
        </Text>
      </Card>
    </Pressable>
  );
}

export default function HubHome() {
  const router = useRouter();
  const [orders, setOrders] = useState<HubOrder[] | null>(null);
  const [hubName, setHubName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, h] = await Promise.all([api.hubOrders(), api.hub()]);
      setOrders(list);
      setHubName(h.name);
      setError(null);
    } catch (e) {
      setError(`Could not load the hub. ${errMsg(e)}`);
    }
  }, []);
  usePolling(load, 15_000);

  const byStatus = (s: string) => (orders || []).filter((o) => o.status === s);
  const toCheckIn = byStatus('dropped_at_hub').length;
  const riderWaiting = (orders || []).filter((o) => o.rider_waiting).length;

  let title = 'Your hub';
  let body = 'Orders agents drop off show up here.';
  if (orders) {
    if (riderWaiting > 0) {
      title = `${riderWaiting} rider${riderWaiting === 1 ? ' is' : 's are'} waiting`;
      body = 'Open the order and enter the code they show you.';
    } else if (toCheckIn > 0) {
      title = `${toCheckIn} to check in`;
      body = 'An agent has dropped goods off. Check them against the list.';
    } else if (orders.length > 0) {
      title = 'Nothing needs you right now';
      body = 'Everything here is checked in and waiting for a rider.';
    } else {
      title = 'All clear';
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 p-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <Hero
          eyebrow={hubName || 'Hub'}
          live={riderWaiting > 0 || toCheckIn > 0}
          title={title}
          body={body}
          image={require('../../../../assets/illustrations/map-pin-storefront.webp')}
        />
        <ErrorBanner message={error} />
        {orders && orders.length === 0 ? (
          <EmptyState image={require('../../../../assets/illustrations/produce-crate.webp')} title="No orders at your hub" subtitle="When an agent drops an order off, it lands here." />
        ) : null}
        {orders
          ? LANES.map((lane) => {
              const list = byStatus(lane.status);
              if (list.length === 0) return null;
              // Riders who are already standing there go first.
              const sorted = [...list].sort((a, b) => Number(b.rider_waiting) - Number(a.rider_waiting));
              return (
                <View key={lane.status} className="gap-3">
                  <SectionHeader title={lane.title} subtitle={lane.subtitle} />
                  {sorted.map((o) => (
                    <OrderCard key={o.id} order={o} hint={lane.hint} onOpen={() => router.push(`/shopkeeper/orders/${o.id}`)} />
                  ))}
                </View>
              );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
