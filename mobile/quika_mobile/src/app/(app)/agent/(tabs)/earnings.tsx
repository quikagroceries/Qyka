import { Text, View } from 'react-native';

import EarningsView from '@/components/EarningsView';
import { useAgentData } from '@/lib/agentData';

export default function AgentEarnings() {
  const { summary, loaded, error } = useAgentData();
  if (!summary) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F0ECE0' }}>
        <Text style={{ textAlign: 'center', color: error ? '#B3261E' : '#4A4A4A' }}>{loaded && error ? error : 'Loading your earnings…'}</Text>
      </View>
    );
  }
  return (
    <EarningsView
      unit="orders"
      subtitle="Paid per completed order. You never hold customers' money: shop owners are paid directly."
      live={{
        today: summary.earnings_today,
        week: summary.earnings_week,
        total: summary.earnings_total,
        pending: summary.earnings_pending,
        count: summary.completed_orders.length,
        recent: summary.completed_orders.filter((o) => o.delivered_at).map((o) => ({ id: o.id, amount: o.agent_share, at: o.delivered_at as string })),
      }}
    />
  );
}
