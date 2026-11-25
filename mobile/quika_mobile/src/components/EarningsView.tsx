import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { Card, ErrorBanner, Hero, SafeAreaView, SectionHeader, StatTile } from '@/components/ui';
import type { Earnings } from '@/lib/api';
import { ago, errMsg, naira, shortId } from '@/lib/format';
import { usePolling } from '@/lib/usePolling';

// Shared by the rider and the hub: both are paid a fixed fee per delivery.
export default function EarningsView({ load, subtitle }: { load: () => Promise<Earnings>; subtitle: string }) {
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [load]);
  usePolling(refresh, 60_000);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 p-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }>
        <Hero
          eyebrow="Earnings"
          title={data ? naira(data.earnings_total) : '…'}
          body={subtitle}
          image={require('../../assets/illustrations/earn-payout-moment.webp')}>
          {data ? (
            <View className="flex-row gap-3">
              <StatTile label="Today" value={naira(data.earnings_today)} />
              <StatTile label="This week" value={naira(data.earnings_week)} />
              <StatTile label="Deliveries" value={String(data.completed_count)} />
            </View>
          ) : null}
        </Hero>
        <ErrorBanner message={error} />
        {data ? (
          <>
            <SectionHeader title="Recent" />
            {data.recent.length === 0 ? (
              <Text className="text-sm text-muted">Your fee shows up here once a customer confirms a delivery.</Text>
            ) : (
              data.recent.map((r) => (
                <Card key={r.order_id + r.delivered_at} className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-bold text-ink">#{shortId(r.order_id)}</Text>
                    <Text className="text-xs text-faint">{ago(r.delivered_at)}</Text>
                  </View>
                  <Text className="text-base font-extrabold text-brand-green">{naira(r.amount)}</Text>
                </Card>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
