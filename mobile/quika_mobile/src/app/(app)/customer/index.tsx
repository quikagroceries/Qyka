import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Button, Card, ErrorBanner, Hero, SafeAreaView, StatusBadge } from '@/components/ui';
import { api, type AgentOrder, type Market } from '@/lib/api';
import { ago, errMsg, naira, shortId } from '@/lib/format';
import { isHistory, summarize } from '@/lib/orderStatus';
import { usePolling } from '@/lib/usePolling';

type Filter = 'active' | 'history';

export default function Track() {
  const router = useRouter();
  const [orders, setOrders] = useState<AgentOrder[] | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrders(await api.customerOrders());
      setError(null);
      api.markets().then(setMarkets).catch(() => {});
    } catch (e) {
      setError(`Could not load your orders. ${errMsg(e)}`);
    }
  }, []);
  usePolling(load, 20_000);

  const marketName = (id: string) => markets.find((m) => m.id === id)?.name;
  const sorted = [...(orders ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const active = sorted.filter((o) => !isHistory(o.status));
  const shown = filter === 'active' ? active : sorted.filter((o) => isHistory(o.status));

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
          eyebrow={active.length > 0 ? `${active.length} active` : 'Track'}
          live={active.length > 0}
          title={active.length > 0 ? 'Your orders are on the move' : 'Nothing in progress'}
          body="Follow each order from the market stall to your door."
          image={require('../../../../assets/illustrations/rider-scooter-basket-1.webp')}>
          <Button label="Start a new order" onPress={() => router.push('/customer/new-order')} />
        </Hero>

        <View className="flex-row gap-2">
          {(['active', 'history'] as Filter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={'rounded-full px-4 py-2 ' + (filter === f ? 'bg-brand-orange' : 'border border-line bg-surface')}>
              <Text className={'text-sm font-bold ' + (filter === f ? 'text-ink' : 'text-muted')}>{f === 'active' ? 'Active' : 'History'}</Text>
            </Pressable>
          ))}
        </View>

        <ErrorBanner message={error} />
        {orders && shown.length === 0 ? (
          <Card className="items-center">
            <Text className="text-base font-bold text-ink">{filter === 'active' ? 'No active orders' : 'No past orders yet'}</Text>
            <Text className="text-center text-sm text-muted">{filter === 'active' ? 'Orders you place show up here.' : 'Delivered and cancelled orders land here.'}</Text>
          </Card>
        ) : null}
        {shown.map((o) => (
          <Pressable key={o.id} onPress={() => router.push(`/customer/orders/${o.id}`)} className="active:opacity-80">
            <Card>
              <View className="flex-row items-center justify-between">
                <StatusBadge status={o.status} />
                <Text className="text-xs text-faint">{ago(o.created_at)}</Text>
              </View>
              <Text className="mt-1 text-base font-bold text-ink">{summarize(o, marketName(o.market_id))}</Text>
              <Text className="text-sm text-muted">
                {marketName(o.market_id) || 'Market'} · {o.items.length} item{o.items.length === 1 ? '' : 's'} · #{shortId(o.id)}
              </Text>
              {Number(o.grand_total) > 0 ? <Text className="text-sm font-semibold text-ink">{naira(o.grand_total)}</Text> : null}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
