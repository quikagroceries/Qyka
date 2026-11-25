import { View } from 'react-native';
import { Text } from '@/components/Text';

import { Button } from '@/components/ui';
import { naira } from '@/lib/format';

// Both payment moments (deposit before shopping, balance after) offer the same
// choice: wallet when it covers the amount, bank transfer always.
export default function PaymentChooser({
  amountDue,
  walletBalance,
  onPayWallet,
  onPayTransfer,
  onTopUp,
}: {
  amountDue: number;
  walletBalance: string;
  onPayWallet: () => void;
  onPayTransfer: () => void;
  onTopUp?: () => void;
}) {
  const insufficient = Number(walletBalance) < amountDue;
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
      <Button label="Pay by bank transfer" variant="secondary" onPress={onPayTransfer} />
      {insufficient && onTopUp ? <Button label="Top up wallet" variant="neutral" onPress={onTopUp} /> : null}
    </View>
  );
}
