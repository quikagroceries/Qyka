import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { Button } from '@/components/ui';
import { naira } from '@/lib/format';

// Both payment moments (deposit before shopping, balance after) are paid from the wallet. If it is short, the customer adds money on the
// wallet screen (card, through Paystack); in development builds there is also an instant dev top-up here.
export default function PaymentChooser({
  amountDue,
  walletBalance,
  onPayWallet,
  onTopUp,
}: {
  amountDue: number;
  walletBalance: string;
  /** Pays from the wallet. May reject; the message is shown. */
  onPayWallet: () => Promise<void>;
  /** Development only: adds the missing money to the wallet. */
  onTopUp?: (missing: number) => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'pay' | 'topup' | null>(null);
  const [error, setError] = useState('');
  const balance = Number(walletBalance);
  const missing = Math.max(0, amountDue - balance);
  const insufficient = missing > 0;

  const run = async (kind: 'pay' | 'topup', fn: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="gap-2">
      <View className="flex-row justify-between">
        <Text className="text-muted">Wallet balance</Text>
        <Text className="font-semibold text-ink">{naira(balance)}</Text>
      </View>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="font-semibold text-ink">Amount due</Text>
        <Text className="text-lg font-bold text-ink">{naira(amountDue)}</Text>
      </View>
      <Button label="Pay from wallet" busy={busy === 'pay'} disabled={insufficient || busy !== null} onPress={() => run('pay', onPayWallet)} />
      {insufficient ? (
        <Text className="text-center text-sm text-brand-orange-dark">
          Your wallet is {naira(missing)} short.
        </Text>
      ) : null}
      {insufficient ? <Button label="Add money to your wallet" variant="outline" disabled={busy !== null} onPress={() => router.push('/customer/wallet')} /> : null}
      {insufficient && onTopUp ? <Button label={`Dev: add ${naira(missing)} to wallet`} variant="outline" busy={busy === 'topup'} disabled={busy !== null} onPress={() => run('topup', () => onTopUp(missing))} /> : null}
      {error ? <Text className="text-center text-sm font-semibold text-red-700">{error}</Text> : null}
    </View>
  );
}
