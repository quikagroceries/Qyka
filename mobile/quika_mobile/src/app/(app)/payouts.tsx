import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import { Text } from '@/components/Text';
import { Button, Field, SafeAreaView } from '@/components/ui';
import { api, type Bank } from '@/lib/api';
import { clockTime, dayLabel, errMsg, naira } from '@/lib/format';
import { STATUS_LABEL, usePayouts } from '@/lib/payouts';

/** Take earnings out to a bank account. Shared by the agent, the rider and the shopkeeper. */
export default function Payouts() {
  const router = useRouter();
  const { summary, history, error, loaded, reload } = usePayouts();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const value = Number(amount);

  const withdraw = async () => {
    if (!summary) return;
    if (!(value >= summary.min_withdrawal)) return setProblem(`The smallest withdrawal is ${naira(summary.min_withdrawal)}.`);
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      const p = await api.withdraw(value);
      setAmount('');
      setNotice(p.status === 'pending_review' ? `${naira(p.amount)} is being reviewed${p.hold_reason === 'First withdrawal' ? ' (first withdrawals are always checked)' : ''}. We'll tell you when it's sent.` : p.status === 'paid' ? `${naira(p.amount)} is on its way to your ${p.bank_name} account.` : `${naira(p.amount)} is being sent. This can take a few minutes.`);
      await reload();
    } catch (e) {
      setProblem(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const days: { label: string; rows: typeof history }[] = [];
  history.forEach((p) => {
    const label = dayLabel(p.created_at);
    const last = days[days.length - 1];
    if (last && last.label === label) last.rows.push(p);
    else days.push({ label, rows: [p] });
  });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-12 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
          <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>
          <View className="h-11 w-11" />
        </Animated.View>

        <PageHeader top="Withdraw" accent="earnings" subtitle="Send what you've earned to your bank account. We cover the transfer fee." art={require('../../../assets/illustrations/earn-payout-moment.webp')} artSize={{ width: 110, height: 82 }} />

        {!summary ? (
          <Text className="py-10 text-center text-muted">{loaded && error ? error : 'Loading…'}</Text>
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(60).duration(450)} className="gap-1 rounded-3xl bg-brand-orange/20 px-5 py-5">
              <Text className="text-sm font-semibold text-ink/70">Available to withdraw</Text>
              <Text className="text-[40px] font-extrabold leading-[46px] tracking-tight text-ink">{naira(summary.available)}</Text>
              <Text className="text-xs leading-4 text-ink/70">
                {Number(summary.in_review) > 0 ? `${naira(summary.in_review)} is under review. ` : ''}
                Up to {naira(summary.max_per_withdrawal)} at a time and {naira(summary.daily_limit)} a day.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(110).duration(450)} className="gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-extrabold tracking-tight text-ink">Bank account</Text>
                {summary.account && !editing ? (
                  <Pressable onPress={() => setEditing(true)} hitSlop={8}>
                    <Text className="text-sm font-bold text-brand-orange-dark">Change</Text>
                  </Pressable>
                ) : null}
              </View>
              {summary.account && !editing ? (
                <View className="gap-0.5">
                  <Text className="text-base font-bold text-ink">{summary.account.account_name}</Text>
                  <Text className="text-sm text-muted">
                    {summary.account.bank_name} · {summary.account.account_number}
                  </Text>
                </View>
              ) : (
                <AccountForm
                  onSaved={async () => {
                    setEditing(false);
                    await reload();
                  }}
                  onCancel={summary.account ? () => setEditing(false) : undefined}
                />
              )}
            </Animated.View>

            {summary.account && !editing ? (
              <Animated.View entering={FadeInDown.delay(160).duration(450)} className="gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm">
                <Text className="text-lg font-extrabold tracking-tight text-ink">Withdraw</Text>
                <Field value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} placeholder="Amount in ₦" keyboardType="number-pad" />
                <View className="flex-row flex-wrap gap-2">
                  {Number(summary.can_withdraw_now) > 0 ? (
                    <Pressable onPress={() => setAmount(String(Math.floor(Number(summary.can_withdraw_now))))} className="rounded-full border border-line-strong bg-surface px-3.5 py-1.5 active:bg-sunken">
                      <Text className="text-xs font-bold text-ink">Max {naira(Math.floor(Number(summary.can_withdraw_now)))}</Text>
                    </Pressable>
                  ) : null}
                </View>
                {problem ? <Text className="text-sm font-semibold text-red-700">{problem}</Text> : null}
                {notice ? <Text className="text-sm font-semibold text-brand-army">{notice}</Text> : null}
                <Button label={value > 0 ? `Withdraw ${naira(value)}` : 'Withdraw'} busy={busy} disabled={!(value > 0)} onPress={withdraw} />
                <Text className="text-center text-xs text-faint">Your first withdrawal and unusually large ones are checked by our team before they&apos;re sent.</Text>
              </Animated.View>
            ) : null}

            <View className="gap-4">
              <Text className="text-lg font-extrabold tracking-tight text-ink">Withdrawals</Text>
              {days.length === 0 ? (
                <View className="items-center rounded-3xl border border-line bg-surface px-6 py-8">
                  <Text className="text-base font-bold text-ink">Nothing withdrawn yet</Text>
                  <Text className="text-center text-sm text-muted">Your withdrawals will be listed here.</Text>
                </View>
              ) : (
                days.map((day) => (
                  <View key={day.label} className="gap-2">
                    <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">{day.label}</Text>
                    <View className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
                      {day.rows.map((p, i) => {
                        const st = STATUS_LABEL[p.status] ?? { text: p.status, tone: 'wait' as const };
                        return (
                          <View key={p.id} className={'flex-row items-center gap-3 px-4 py-3.5 ' + (i > 0 ? 'border-t border-dashed border-line-strong' : '')}>
                            <View className="flex-1 gap-0.5">
                              <Text className="text-base font-bold text-ink">{naira(p.amount)}</Text>
                              <Text className="text-xs text-muted" numberOfLines={1}>
                                {p.bank_name} · {p.account_number} · {clockTime(p.created_at)}
                              </Text>
                            </View>
                            <View className={'rounded-full px-2.5 py-1 ' + (st.tone === 'ok' ? 'bg-brand-green/15' : st.tone === 'bad' ? 'bg-red-100' : 'bg-gold/40')}>
                              <Text className={'text-[11px] font-bold ' + (st.tone === 'ok' ? 'text-brand-army' : st.tone === 'bad' ? 'text-red-700' : 'text-ink')}>{st.text}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Pick a bank and type the account number. The server looks up the account name, which is shown back once saved. */
function AccountForm({ onSaved, onCancel }: { onSaved: () => void | Promise<void>; onCancel?: () => void }) {
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [number, setNumber] = useState('');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const openPicker = async () => {
    setPicking(true);
    if (!banks) {
      try {
        setBanks(await api.payoutBanks());
      } catch (e) {
        setProblem(errMsg(e));
        setPicking(false);
      }
    }
  };

  const save = async () => {
    if (!bank) return setProblem('Choose your bank.');
    if (number.length !== 10) return setProblem('An account number has 10 digits.');
    setBusy(true);
    setProblem('');
    try {
      await api.savePayoutAccount(bank.code, number);
      await onSaved();
    } catch (e) {
      setProblem(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3">
      <Pressable onPress={openPicker} className="flex-row items-center justify-between rounded-full border border-line bg-surface px-5 py-4 active:bg-sunken">
        <Text className={bank ? 'text-base text-ink' : 'text-base text-faint'}>{bank ? bank.name : 'Choose your bank'}</Text>
        <Text className="text-muted">▾</Text>
      </Pressable>
      <Field value={number} onChangeText={(t) => setNumber(t.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit account number" keyboardType="number-pad" />
      {problem ? <Text className="text-sm font-semibold text-red-700">{problem}</Text> : null}
      <Button label="Save account" busy={busy} onPress={save} />
      {onCancel ? <Button label="Cancel" variant="outline" onPress={onCancel} /> : null}

      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <Pressable onPress={() => setPicking(false)} className="flex-1 justify-end bg-black/40">
          <View className="max-h-[70%] rounded-t-3xl bg-canvas px-5 pb-8 pt-4">
            <Text className="mb-2 text-lg font-extrabold text-ink">Choose your bank</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(banks ?? []).map((b) => (
                <Pressable
                  key={b.code}
                  onPress={() => {
                    setBank(b);
                    setPicking(false);
                  }}
                  className="border-b border-line py-3.5 active:bg-sunken">
                  <Text className="text-base text-ink">{b.name}</Text>
                </Pressable>
              ))}
              {!banks ? <Text className="py-6 text-center text-muted">Loading…</Text> : null}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
