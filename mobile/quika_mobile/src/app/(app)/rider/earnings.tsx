import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Card, ErrorBanner, Title } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { api, type Earnings } from '@/lib/api';
import { ago, errMsg, naira, shortId } from '@/lib/format';
import { usePolling } from '@/lib/usePolling';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Body style={{ fontSize: 13 }}>{label}</Body>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  );
}

export default function EarningsScreen() {
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.riderEarnings());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  usePolling(load, 60_000);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.body}
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
        <Title>Earnings</Title>
        <ErrorBanner message={error} />
        {data && (
          <>
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Stat label="Today" value={naira(data.earnings_today)} />
              <Stat label="This week" value={naira(data.earnings_week)} />
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Stat label="All time" value={naira(data.earnings_total)} />
              <Stat label="Deliveries" value={String(data.completed_count)} />
            </View>
            <Body style={styles.section}>Recent</Body>
            {data.recent.length === 0 ? (
              <Body>Your fee shows up here once a customer confirms a delivery.</Body>
            ) : (
              data.recent.map((r) => (
                <Card key={r.order_id + r.delivered_at} style={styles.row}>
                  <View>
                    <Text style={styles.rowTitle}>#{shortId(r.order_id)}</Text>
                    <Body style={{ fontSize: 13 }}>{ago(r.delivered_at)}</Body>
                  </View>
                  <Text style={styles.rowTitle}>{naira(r.amount)}</Text>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  body: { padding: Spacing.four, gap: Spacing.three },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.ink },
  section: { fontWeight: '700', color: Colors.ink, marginTop: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: Colors.ink },
});
