import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import { Text } from '@/components/Text';
import { Button, Field, SafeAreaView } from '@/components/ui';
import { api, type WalletEntry } from '@/lib/api';
import { clockTime, dayLabel, naira, shortId } from '@/lib/format';
import { useWallet, useWalletSync, walletStore } from '@/lib/wallet';

const QUICK = [1000, 2000, 5000, 10000];
const MIN_TOP_UP = 100;

/** A plain-words title for a wallet entry, from the server's note ("Deposit for order 1a2b…"). */
function titleFor(e: WalletEntry): string {
  const n = e.note ?? '';
  if (/refund/i.test(n)) return 'Deposit refunded';
  if (/^deposit/i.test(n)) return 'Deposit paid';
  if (/top-?up|fund/i.test(n)) return 'Money added';
  if (/balance|order/i.test(n)) return 'Order payment';
  return n.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, (id) => `#${shortId(id)}`) || (e.direction === 'credit' ? 'Money added' : 'Payment');
}

export default function Wallet() {
  const router = useRouter();
  useWalletSync();
  const { balance, entries, loaded, error } = useWallet();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  // A card payment that was started but not yet confirmed: the customer can ask again.
  const [waitingRef, setWaitingRef] = useState<string | null>(null);

  const value = Number(amount);

  const check = async (reference: string) => {
    const res = await api.verifyWalletFunding(reference);
    if (res.verified) {
      setNotice('Payment received. Your wallet is topped up.');
      setWaitingRef(null);
      setAmount('');
      await walletStore.refresh();
    } else {
      setWaitingRef(reference);
      setNotice("We haven't received the payment yet. If you've paid, give it a moment and check again.");
    }
  };

  const addMoney = async () => {
    if (!(value >= MIN_TOP_UP)) return setProblem(`Enter at least ${naira(MIN_TOP_UP)}.`);
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      const init = await api.fundWalletInit(value);
      // The payment page opens in the app. When the customer closes it, we ask the server to check with Paystack.
      await WebBrowser.openBrowserAsync(init.authorization_url);
      await check(init.reference);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const devTopUp = async () => {
    if (!(value > 0)) return setProblem('Enter an amount first.');
    setBusy(true);
    setProblem('');
    try {
      await api.fundWalletDev(value);
      setNotice(`${naira(value)} added (development top-up).`);
      setAmount('');
      await walletStore.refresh();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // One group per day, newest first, like a statement.
  const days: { label: string; rows: WalletEntry[] }[] = [];
  [...entries]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .forEach((e) => {
      const label = dayLabel(e.created_at);
      const last = days[days.length - 1];
      if (last && last.label === label) last.rows.push(e);
      else days.push({ label, rows: [e] });
    });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-12 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/customer'))} hitSlop={10} accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>
          <View className="h-11 w-11" />
        </Animated.View>

        <PageHeader top="Your" accent="wallet" subtitle="Pay deposits and balances from here." art={require('../../../../assets/illustrations/wallet.webp')} artSize={{ width: 110, height: 82 }} />

        <Animated.View entering={FadeInDown.delay(60).duration(450)} className="gap-1 rounded-3xl bg-brand-orange/20 px-5 py-5">
          <Text className="text-sm font-semibold text-ink/70">Wallet balance</Text>
          <Text className="text-[40px] font-extrabold leading-[46px] tracking-tight text-ink">{balance === null ? '…' : naira(balance)}</Text>
          <Text className="text-xs leading-4 text-ink/70">Used when you pay for an order. A cancelled order&apos;s deposit comes back here.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(450)} className="gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <Text className="text-lg font-extrabold tracking-tight text-ink">Add money</Text>
          <Field value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} placeholder="Amount in ₦" keyboardType="number-pad" />
          <View className="flex-row flex-wrap gap-2">
            {QUICK.map((q) => (
              <Pressable key={q} onPress={() => setAmount(String(q))} className={'rounded-full border px-3.5 py-2 active:bg-sunken ' + (value === q ? 'border-brand-orange bg-brand-orange/15' : 'border-line-strong bg-surface')}>
                <Text className="text-xs font-bold text-ink">{naira(q)}</Text>
              </Pressable>
            ))}
          </View>
          {problem ? <Text className="text-sm font-semibold text-red-700">{problem}</Text> : null}
          {notice ? <Text className="text-sm font-semibold text-brand-army">{notice}</Text> : null}
          <Button label="Pay with card" busy={busy} onPress={addMoney} />
          {waitingRef ? <Button label="Check my payment" variant="outline" disabled={busy} onPress={() => void check(waitingRef).catch((e: Error) => setProblem(e.message))} /> : null}
          {__DEV__ ? <Button label="Dev: add instantly" variant="outline" disabled={busy} onPress={devTopUp} /> : null}
        </Animated.View>

        <View className="gap-4">
          <Text className="text-lg font-extrabold tracking-tight text-ink">History</Text>
          {!loaded ? <Text className="text-center text-sm text-muted">Loading your wallet…</Text> : null}
          {error ? (
            <View className="items-center gap-2 rounded-3xl border border-line bg-surface p-4">
              <Text className="text-center text-sm font-semibold text-red-700">{error}</Text>
              <Button label="Try again" variant="outline" onPress={() => void walletStore.refresh()} />
            </View>
          ) : null}
          {loaded && !error && days.length === 0 ? (
            <View className="items-center gap-1 rounded-3xl border border-line bg-surface px-6 py-8">
              <Image source={require('../../../../assets/illustrations/history.webp')} resizeMode="contain" className="h-24 w-32" />
              <Text className="mt-1 text-base font-bold text-ink">No activity yet</Text>
              <Text className="text-center text-sm text-muted">Top-ups, deposits and refunds show up here.</Text>
            </View>
          ) : null}
          {days.map((day, di) => (
            <Animated.View key={day.label} entering={FadeInDown.delay(di * 60).duration(400)} className="gap-2">
              <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">{day.label}</Text>
              <View className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
                {day.rows.map((e, i) => {
                  const credit = e.direction === 'credit';
                  const body = (
                    <View className={'flex-row items-center gap-3 px-4 py-3.5 ' + (i > 0 ? 'border-t border-dashed border-line-strong' : '')}>
                      <View className={'h-12 w-12 items-center justify-center rounded-2xl ' + (credit ? 'bg-brand-green/15' : 'bg-brand-orange/15')}>
                        <Image source={credit ? require('../../../../assets/illustrations/wallet.webp') : require('../../../../assets/illustrations/shop.webp')} resizeMode="contain" className="h-9 w-9" />
                      </View>
                      <View className="flex-1 gap-0.5">
                        <Text className="text-base font-bold text-ink" numberOfLines={1}>
                          {titleFor(e)}
                        </Text>
                        <Text className="text-xs text-muted" numberOfLines={1}>
                          {e.order_id ? `Order #${shortId(e.order_id)} · ` : ''}
                          {clockTime(e.created_at)}
                        </Text>
                      </View>
                      <View className="items-end gap-0.5">
                        <Text className={'text-base font-extrabold ' + (credit ? 'text-brand-army' : 'text-ink')}>
                          {credit ? '+' : '−'}
                          {naira(e.amount)}
                        </Text>
                        <Text className="text-[11px] text-faint">Balance {naira(e.balance_after)}</Text>
                      </View>
                    </View>
                  );
                  return e.order_id ? (
                    <Pressable key={e.id} onPress={() => router.push(`/customer/orders/${e.order_id}`)} className="active:bg-surface-2">
                      {body}
                    </Pressable>
                  ) : (
                    <View key={e.id}>{body}</View>
                  );
                })}
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
