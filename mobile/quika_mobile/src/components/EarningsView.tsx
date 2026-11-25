import { ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import { Card, EmptyState, Hero, SafeAreaView, SectionHeader, StatTile } from '@/components/ui';
import { ago, naira, shortId } from '@/lib/format';
import { EARNINGS } from '@/lib/mock';

// Shared by the rider and the hub: both are paid a fixed fee per delivery.
export default function EarningsView({ subtitle }: { subtitle: string }) {
  const data = EARNINGS;
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4">
        <Hero eyebrow="Earnings" title={naira(data.earnings_total)} body={subtitle} image={require('../../assets/illustrations/earn-payout-moment.webp')}>
          <View className="flex-row gap-3">
            <StatTile label="Today" value={naira(data.earnings_today)} />
            <StatTile label="This week" value={naira(data.earnings_week)} />
            <StatTile label="Deliveries" value={String(data.completed_count)} />
          </View>
        </Hero>
        <SectionHeader title="Recent" />
        {data.recent.length === 0 ? (
          <EmptyState image={require('../../assets/illustrations/wallet.webp')} title="No earnings yet" subtitle="Your fee shows up here once a customer confirms a delivery." />
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
      </ScrollView>
    </SafeAreaView>
  );
}
