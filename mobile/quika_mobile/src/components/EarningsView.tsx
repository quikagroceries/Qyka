import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import StatTiles from '@/components/StatTiles';
import SegmentedToggle from '@/components/SegmentedToggle';
import { Text } from '@/components/Text';
import { Button, SafeAreaView } from '@/components/ui';
import WithdrawSheet from '@/components/WithdrawSheet';
import { clockTime, dayLabel, naira, shortId } from '@/lib/format';
import { EARNINGS, PAYOUT } from '@/lib/mock';

type Withdrawal = { id: string; amount: number; at: string };
type Filter = 'all' | 'earned' | 'withdrawn';

const LIST = ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'];
const PLUS = ['M12 5v14', 'M5 12h14'];
const OUT = ['M7 17 17 7', 'M7 7h10v10'];

/**
 * Money earned, for the agent, the rider and the hub: what you can withdraw, what's still waiting on
 * a customer's confirmation, and the history. `unit` is what you're paid per (order, delivery...).
 * UI only: a withdrawal lowers the balance here and sends nothing.
 */
export default function EarningsView({ subtitle, unit = 'deliveries' }: { subtitle: string; unit?: string }) {
  const data = EARNINGS;
  const [withdrawn, setWithdrawn] = useState<Withdrawal[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const available = PAYOUT.available - withdrawn.reduce((n, w) => n + w.amount, 0);

  const history = [
    ...data.recent.map((r) => ({ id: r.order_id + r.delivered_at, kind: 'earned' as const, label: `#${shortId(r.order_id)}`, amount: Number(r.amount), at: r.delivered_at })),
    ...withdrawn.map((w) => ({ id: w.id, kind: 'withdrawn' as const, label: `To ${PAYOUT.bank.name} •••• ${PAYOUT.bank.last4}`, amount: w.amount, at: w.at })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const earnedCount = history.filter((h) => h.kind === 'earned').length;
  const shown = history.filter((h) => filter === 'all' || h.kind === (filter === 'earned' ? 'earned' : 'withdrawn'));
  // One group per day, newest first, like a statement.
  const days: { label: string; rows: typeof history }[] = [];
  shown.forEach((h) => {
    const label = dayLabel(h.at);
    const last = days[days.length - 1];
    if (last && last.label === label) last.rows.push(h);
    else days.push({ label, rows: [h] });
  });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-3" showsVerticalScrollIndicator={false}>
        <PageHeader top="Your" accent="earnings" subtitle={subtitle} art={require('../../assets/illustrations/earn-payout-moment.webp')} artSize={{ width: 132, height: 99 }} />

        <Animated.View entering={FadeInDown.delay(60).duration(450)} className="gap-4 rounded-3xl bg-brand-orange/20 p-5">
          <View className="flex-row items-end justify-between">
            <View className="gap-0.5">
              <Text className="text-sm font-semibold text-ink/70">Available to withdraw</Text>
              <Text className="text-[36px] font-extrabold leading-[42px] tracking-tight text-ink">{naira(available)}</Text>
            </View>
            <View className="items-end gap-0.5">
              <Text className="text-xs font-semibold text-ink/70">Pending</Text>
              <Text className="text-base font-extrabold text-ink">{naira(PAYOUT.pending)}</Text>
            </View>
          </View>
          <Button label="Withdraw" disabled={available <= 0} onPress={() => setOpen(true)} />
          <Text className="text-xs leading-4 text-ink/70">Pending money is released once the customer confirms the order. It&apos;s paid to {PAYOUT.bank.name} •••• {PAYOUT.bank.last4}.</Text>
        </Animated.View>

        <StatTiles
          items={[
            { value: naira(data.earnings_today), label: 'Today', art: require('../../assets/illustrations/wallet.webp'), tint: 'bg-brand-orange/15', hot: true },
            { value: naira(data.earnings_week), label: 'This week', art: require('../../assets/illustrations/earn-payout-moment.webp'), tint: 'bg-gold/40' },
            { value: data.completed_count, label: unit.charAt(0).toUpperCase() + unit.slice(1), art: require('../../assets/illustrations/grocery-basket.webp'), tint: 'bg-brand-green/15' },
          ]}
        />

        <View className="gap-4">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-lg font-extrabold tracking-tight text-ink">History</Text>
            <Text className="text-xs font-semibold text-muted">{naira(data.earnings_total)} earned in total</Text>
          </View>

          <SegmentedToggle
            value={filter}
            onChange={setFilter}
            segments={[
              { id: 'all', label: 'All', icon: LIST },
              { id: 'earned', label: 'Earned', icon: PLUS, count: earnedCount },
              { id: 'withdrawn', label: 'Paid out', icon: OUT, count: withdrawn.length },
            ]}
          />

          {days.length === 0 ? (
            <View className="items-center gap-1 rounded-3xl border border-line bg-surface px-6 py-8">
              <Image source={require('../../assets/illustrations/wallet.webp')} resizeMode="contain" className="h-24 w-32" />
              <Text className="mt-1 text-base font-bold text-ink">{filter === 'withdrawn' ? 'No payouts yet' : 'No earnings yet'}</Text>
              <Text className="text-center text-sm text-muted">{filter === 'withdrawn' ? 'When you withdraw, it shows up here.' : 'Your fee shows up here once a customer confirms the order.'}</Text>
            </View>
          ) : (
            days.map((day, di) => (
              <Animated.View key={day.label} entering={FadeInDown.delay(di * 80).duration(450)} className="gap-2">
                <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">{day.label}</Text>
                <View className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
                  {day.rows.map((h, i) => {
                    const earned = h.kind === 'earned';
                    return (
                      <View key={h.id} className={'flex-row items-center gap-3 px-4 py-3.5 ' + (i > 0 ? 'border-t border-dashed border-line-strong' : '')}>
                        <View className={'h-12 w-12 items-center justify-center rounded-2xl ' + (earned ? 'bg-brand-green/15' : 'bg-brand-orange/15')}>
                          <Image source={earned ? require('../../assets/illustrations/grocery-basket.webp') : require('../../assets/illustrations/wallet.webp')} resizeMode="contain" className="h-9 w-9" />
                        </View>
                        <View className="flex-1 gap-0.5">
                          <Text className="text-base font-bold text-ink" numberOfLines={1}>
                            {earned ? `Order ${h.label}` : 'Withdrawal'}
                          </Text>
                          <Text className="text-xs text-muted" numberOfLines={1}>
                            {earned ? 'Completed' : h.label} · {clockTime(h.at)}
                          </Text>
                        </View>
                        <View className="items-end gap-1">
                          <Text className={'text-base font-extrabold ' + (earned ? 'text-brand-army' : 'text-ink')}>
                            {earned ? '+' : '−'}
                            {naira(h.amount)}
                          </Text>
                          <View className={'rounded-full px-2 py-0.5 ' + (earned ? 'bg-brand-green/15' : 'bg-brand-orange/15')}>
                            <Text className={'text-[10px] font-bold ' + (earned ? 'text-brand-army' : 'text-brand-orange-dark')}>{earned ? 'Paid' : 'Sent'}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>

      <WithdrawSheet
        visible={open}
        onClose={() => setOpen(false)}
        available={available}
        bank={PAYOUT.bank}
        onConfirm={(amount) => setWithdrawn((cur) => [{ id: `w-${cur.length}`, amount, at: new Date().toISOString() }, ...cur])}
      />
    </SafeAreaView>
  );
}
