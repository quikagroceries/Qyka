import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Card, EmptyState, ErrorBanner, Hero, SafeAreaView, SectionHeader, StatTile, StatusBadge } from '@/components/ui';
import { api, ApiError, type AgentOrder, type Market } from '@/lib/api';
import { errMsg, shortId } from '@/lib/format';
import { useSession } from '@/lib/session';
import { usePolling } from '@/lib/usePolling';

const readyToShop = (o: AgentOrder) => o.status === 'agent_assigned';
const inProgress = (o: AgentOrder) => o.status === 'shopping';
const needsDrop = (o: AgentOrder) => o.status === 'paid';
const needsAttention = (o: AgentOrder) => o.status === 'cancelled_unpaid';

function TaskCard({ order, market, tone, onOpen }: { order: AgentOrder; market?: string; tone: 'ready' | 'progress' | 'attention'; onOpen: () => void }) {
  const n = order.items?.length ?? 0;
  const border = tone === 'ready' ? 'border-brand-orange/60' : tone === 'attention' ? 'border-red-300' : 'border-line';
  return (
    <Pressable onPress={onOpen} className="active:opacity-80">
      <Card className={`border-2 ${border}`}>
        <View className="flex-row items-center justify-between">
          <StatusBadge status={order.status} />
          <Text className="text-xs text-faint">Order {shortId(order.id)}</Text>
        </View>
        <Text className="mt-2 text-muted">
          {n} item{n === 1 ? '' : 's'}
        </Text>
        <Text className="text-base font-semibold text-ink/80">{market || '—'}</Text>
        {tone === 'attention' ? (
          <Text className="mt-1 text-sm font-semibold text-red-600">Balance wasn&apos;t paid. Please return these goods to the market or vendor.</Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

export default function AgentHome() {
  const router = useRouter();
  const { signOut } = useSession();
  const [orders, setOrders] = useState<AgentOrder[] | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrders(await api.agentOrders());
      setError(null);
      api.markets().then(setMarkets).catch(() => {});
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return void signOut();
      setError(`Could not load your tasks. ${errMsg(e)}`);
    }
  }, [signOut]);
  usePolling(load, 15_000);

  const marketName = (id: string) => markets.find((m) => m.id === id)?.name;
  const all = orders ?? [];
  const drop = all.filter(needsDrop);
  const ready = all.filter(readyToShop);
  const going = all.filter(inProgress);
  const attention = all.filter(needsAttention);
  const actionable = drop.length + ready.length + going.length;

  const title = !orders
    ? 'Loading your tasks…'
    : attention.length > 0
      ? 'Something needs your attention'
      : drop.length > 0
        ? 'Goods are waiting to go to the hub'
        : ready.length > 0
          ? 'A list is waiting for you'
          : going.length > 0
            ? "You're mid-run. Keep going."
            : 'All clear for now';

  const section = (heading: string, subtitle: string, list: AgentOrder[], tone: 'ready' | 'progress' | 'attention') =>
    list.length === 0 ? null : (
      <View className="gap-3">
        <SectionHeader title={heading} subtitle={subtitle} />
        {list.map((o) => (
          <TaskCard key={o.id} order={o} tone={tone} market={marketName(o.market_id)} onOpen={() => router.push(`/agent/orders/${o.id}`)} />
        ))}
      </View>
    );

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
          eyebrow={actionable > 0 ? `${actionable} task${actionable === 1 ? '' : 's'} waiting` : 'Agent home'}
          live={actionable > 0}
          title={title}
          body="Your tasks, most urgent first. Open one to see the list and start shopping."
          image={actionable - drop.length > 0 ? require('../../../../assets/illustrations/market-cart-vendor.webp') : undefined}>
          <View className="flex-row gap-2">
            <StatTile label="To hub" value={String(drop.length)} />
            <StatTile label="Ready" value={String(ready.length)} />
            <StatTile label="Shopping" value={String(going.length)} />
          </View>
        </Hero>

        <ErrorBanner message={error} />
        {orders && actionable === 0 && attention.length === 0 && !error ? (
          <EmptyState image={require('../../../../assets/illustrations/shopping-cart.webp')} title="No tasks right now" subtitle="New assignments will show up here." />
        ) : null}

        {section('Needs attention', "The customer didn't pay the balance in time. The deposit is forfeited. Return the goods you already bought.", attention, 'attention')}
        {section('Take to the hub', 'Paid and bought. Drop these at the hub in the market.', drop, 'ready')}
        {section('Ready to shop', 'Start shopping now.', ready, 'ready')}
        {section('In progress', "You're actively shopping these.", going, 'progress')}
      </ScrollView>
    </SafeAreaView>
  );
}
