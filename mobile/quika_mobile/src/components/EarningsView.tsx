import { useRouter } from 'expo-router';
import { Image, ScrollView, Text as RNText, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import StatTiles from '@/components/StatTiles';
import { Text } from '@/components/Text';
import { Button, SafeAreaView } from '@/components/ui';
import { clockTime, dayLabel, naira, shortId } from '@/lib/format';
import { useServerEarnings } from '@/lib/earnings';
import { useAvailable } from '@/lib/payouts';

/** Real figures from the server. */
export type LiveEarnings = { today: string; week: string; total: string; pending: string; count: number; recent: { id: string; amount: string; at: string }[] };

/**
 * Money earned, for the agent, the rider and the hub: what's been earned, what's still waiting on a customer's confirmation, and each
 * order's fee. `unit` is what you're paid per (order, delivery...).
 */
export default function EarningsView({ subtitle, unit = 'deliveries', live }: { subtitle: string; unit?: string; live: LiveEarnings }) {
  const router = useRouter();
  const available = useAvailable();
  // One group per day, newest first, like a statement.
  const days: { label: string; rows: LiveEarnings['recent'] }[] = [];
  [...live.recent]
    .sort((a, b) => b.at.localeCompare(a.at))
    .forEach((r) => {
      const label = dayLabel(r.at);
      const last = days[days.length - 1];
      if (last && last.label === label) last.rows.push(r);
      else days.push({ label, rows: [r] });
    });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-3" showsVerticalScrollIndicator={false}>
        <PageHeader top="Your" accent="earnings" subtitle={subtitle} art={require('../../assets/illustrations/earn-payout-moment.webp')} artSize={{ width: 132, height: 99 }} />

        <Animated.View entering={FadeInDown.delay(60).duration(450)} className="gap-4 rounded-3xl bg-brand-orange/20 p-5">
          <View className="flex-row items-end justify-between">
            <View className="gap-0.5">
              <Text className="text-sm font-semibold text-ink/70">Earned so far</Text>
              <Text className="text-[36px] font-extrabold leading-[42px] tracking-tight text-ink">{naira(live.total)}</Text>
            </View>
            <View className="items-end gap-0.5">
              <Text className="text-xs font-semibold text-ink/70">Pending</Text>
              <Text className="text-base font-extrabold text-ink">{naira(live.pending)}</Text>
            </View>
          </View>
          <Text className="text-xs leading-4 text-ink/70">Pending money is released once the customer confirms the order.</Text>
          <View className="flex-row items-center justify-between gap-3 rounded-2xl bg-surface/70 px-4 py-3">
            <View>
              <Text className="text-xs font-semibold text-ink/70">Ready to withdraw</Text>
              <Text className="text-lg font-extrabold text-ink">{available === null ? '…' : naira(available)}</Text>
            </View>
            <Button label="Withdraw" className="min-h-[44px] px-5" onPress={() => router.push('/payouts')} />
          </View>
        </Animated.View>

        <StatTiles
          items={[
            { value: naira(live.today), label: 'Today', art: require('../../assets/illustrations/wallet.webp'), tint: 'bg-brand-orange/15', hot: true },
            { value: naira(live.week), label: 'This week', art: require('../../assets/illustrations/earn-payout-moment.webp'), tint: 'bg-gold/40' },
            { value: live.count, label: unit.charAt(0).toUpperCase() + unit.slice(1), art: require('../../assets/illustrations/grocery-basket.webp'), tint: 'bg-brand-green/15' },
          ]}
        />

        <View className="gap-4">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-lg font-extrabold tracking-tight text-ink">History</Text>
            <Text className="text-xs font-semibold text-muted">{naira(live.total)} earned in total</Text>
          </View>

          {days.length === 0 ? (
            <View className="items-center gap-1 rounded-3xl border border-line bg-surface px-6 py-8">
              <Image source={require('../../assets/illustrations/wallet.webp')} resizeMode="contain" className="h-24 w-32" />
              <Text className="mt-1 text-base font-bold text-ink">No earnings yet</Text>
              <Text className="text-center text-sm text-muted">Your fee shows up here once a customer confirms the order.</Text>
            </View>
          ) : (
            days.map((day, di) => (
              <Animated.View key={day.label} entering={FadeInDown.delay(di * 80).duration(450)} className="gap-2">
                <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">{day.label}</Text>
                <View className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
                  {day.rows.map((r, i) => (
                    <View key={r.id} className={'flex-row items-center gap-3 px-4 py-3.5 ' + (i > 0 ? 'border-t border-dashed border-line-strong' : '')}>
                      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/15">
                        <Image source={require('../../assets/illustrations/grocery-basket.webp')} resizeMode="contain" className="h-9 w-9" />
                      </View>
                      <View className="flex-1 gap-0.5">
                        <Text className="text-base font-bold text-ink" numberOfLines={1}>
                          Order #{shortId(r.id)}
                        </Text>
                        <Text className="text-xs text-muted">Completed · {clockTime(r.at)}</Text>
                      </View>
                      <View className="items-end gap-1">
                        <Text className="text-base font-extrabold text-brand-army">+{naira(r.amount)}</Text>
                        <View className="rounded-full bg-brand-green/15 px-2 py-0.5">
                          <Text className="text-[10px] font-bold text-brand-army">Paid</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The rider's or the hub's earnings screen: loads the server's figures, then shows them. */
export function ServerEarnings({ kind, subtitle, unit }: { kind: 'rider' | 'hub'; subtitle: string; unit?: string }) {
  const { data, error, loaded } = useServerEarnings(kind);
  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F0ECE0' }}>
        <RNText style={{ textAlign: 'center', color: error ? '#B3261E' : '#4A4A4A' }}>{loaded && error ? error : 'Loading your earnings…'}</RNText>
      </View>
    );
  }
  return (
    <EarningsView
      subtitle={subtitle}
      unit={unit}
      live={{
        today: data.earnings_today,
        week: data.earnings_week,
        total: data.earnings_total,
        pending: '0.00',
        count: data.completed_count,
        recent: data.recent.map((r) => ({ id: r.order_id, amount: r.amount, at: r.delivered_at })),
      }}
    />
  );
}
