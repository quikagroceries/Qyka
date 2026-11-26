import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/Text';
import { Button } from '@/components/ui';
import { naira } from '@/lib/format';

// UI-only sample account: nothing is verified or sent anywhere.
const BANK = { bank: 'Wema Bank', name: 'Qyka Technologies Ltd', number: '0123456789' };

const BANK_ICON = ['M3 22h18', 'M6 18v-7', 'M10 18v-7', 'M14 18v-7', 'M18 18v-7', 'M12 2 20 7H4Z'];

const Row = ({ label, value, big }: { label: string; value: string; big?: boolean }) => (
  <View className="flex-row items-center justify-between gap-3">
    <Text className="text-sm text-muted">{label}</Text>
    <Text selectable className={big ? 'text-xl font-extrabold tracking-[2px] text-ink' : 'text-sm font-bold text-ink'}>
      {value}
    </Text>
  </View>
);

// Both payment moments (deposit before shopping, balance after) offer the same
// choice: wallet when it covers the amount, bank transfer always.
export default function PaymentChooser({
  amountDue,
  walletBalance,
  reference,
  onPayWallet,
  onPayTransfer,
  onTopUp,
}: {
  amountDue: number;
  walletBalance: string;
  /** Shown to the customer so the transfer can be matched to the order. */
  reference?: string;
  onPayWallet: () => void;
  onPayTransfer: () => void;
  onTopUp?: () => void;
}) {
  const insufficient = Number(walletBalance) < amountDue;
  const [transfer, setTransfer] = useState(false);
  return (
    <View className="gap-2">
      <View className="flex-row justify-between">
        <Text className="text-muted">Wallet balance</Text>
        <Text className="font-semibold text-ink">{naira(walletBalance)}</Text>
      </View>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="font-semibold text-ink">Amount due</Text>
        <Text className="text-lg font-bold text-ink">{naira(amountDue)}</Text>
      </View>
      <Button label="Pay from wallet" disabled={insufficient} onPress={onPayWallet} />
      {insufficient ? <Text className="text-center text-sm text-brand-orange-dark">Insufficient balance: pay by transfer or top up.</Text> : null}

      {!transfer ? (
        <Button
          label="Pay by bank transfer"
          variant="outline"
          onPress={() => setTransfer(true)}
          icon={
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#D9702F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {BANK_ICON.map((d) => (
                <Path key={d} d={d} />
              ))}
            </Svg>
          }
        />
      ) : (
        <Animated.View entering={FadeInDown.duration(350)} className="gap-3 rounded-3xl border border-dashed border-brand-orange/50 bg-brand-orange/[0.08] p-4">
          <Text className="text-center text-sm font-semibold text-ink">
            Send exactly <Text className="font-extrabold text-brand-orange-dark">{naira(amountDue)}</Text> to this account
          </Text>
          <View className="gap-2 rounded-2xl bg-surface p-3">
            <Row label="Bank" value={BANK.bank} />
            <Row label="Account name" value={BANK.name} />
            <Row label="Account number" value={BANK.number} big />
            {reference ? <Row label="Reference" value={reference} /> : null}
          </View>
          <Text className="text-center text-xs text-muted">Put the reference in your transfer note so we can match it to your order.</Text>
          <Button label="I've sent the money" onPress={onPayTransfer} />
          <Pressable onPress={() => setTransfer(false)} hitSlop={8} className="items-center py-1">
            <Text className="text-sm font-bold text-brand-orange-dark">Choose another way to pay</Text>
          </Pressable>
        </Animated.View>
      )}
      {insufficient && onTopUp ? <Button label="Top up wallet" variant="neutral" onPress={onTopUp} /> : null}
    </View>
  );
}
