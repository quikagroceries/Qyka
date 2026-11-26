import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { Button, Field } from '@/components/ui';
import { naira } from '@/lib/format';

type Bank = { name: string; last4: string; holder: string };

function Form({ available, bank, onConfirm, onClose }: { available: number; bank: Bank; onConfirm: (amount: number) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const amount = Number(text);
  const error = text && (!(amount > 0) ? 'Enter an amount' : amount > available ? `You only have ${naira(available)} available` : '');

  if (done !== null) {
    return (
      <View className="items-center gap-3 py-2">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-green/20">
          <Text className="text-3xl font-extrabold text-brand-army">✓</Text>
        </View>
        <Text className="text-2xl font-extrabold tracking-tight text-ink">
          {naira(done)} is <Text className="text-2xl font-extrabold tracking-tight text-brand-orange-dark">on its way</Text>
        </Text>
        <Text className="max-w-[300px] text-center text-sm leading-5 text-muted">
          Sent to {bank.name} •••• {bank.last4}. It usually arrives within a few minutes.
        </Text>
        <Button label="Done" className="self-stretch" onPress={onClose} />
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="items-center gap-1">
        <Text className="text-2xl font-extrabold tracking-tight text-ink">
          Withdraw <Text className="text-2xl font-extrabold tracking-tight text-brand-orange-dark">earnings</Text>
        </Text>
        <Text className="text-sm text-muted">{naira(available)} available</Text>
      </View>

      <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange/15">
          <Text className="text-lg font-extrabold text-brand-orange-dark">{bank.name.charAt(0)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs font-bold uppercase tracking-wide text-faint">To</Text>
          <Text className="text-base font-bold text-ink">
            {bank.name} •••• {bank.last4}
          </Text>
          <Text className="text-xs text-muted">{bank.holder}</Text>
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">Amount (₦)</Text>
        <Field value={text} onChangeText={(t) => setText(t.replace(/[^\d]/g, ''))} placeholder="0" keyboardType="number-pad" />
        {error ? <Text className="ml-2 text-xs font-semibold text-red-700">{error}</Text> : null}
        <View className="flex-row gap-2 pt-1">
          {[1000, 5000].filter((v) => v < available).map((v) => (
            <Pressable key={v} onPress={() => setText(String(v))} className="rounded-full border border-line-strong bg-surface px-3.5 py-2 active:bg-sunken">
              <Text className="text-xs font-bold text-ink">{naira(v)}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setText(String(available))} className="rounded-full border border-brand-orange/50 bg-brand-orange/15 px-3.5 py-2 active:bg-brand-orange/30">
            <Text className="text-xs font-bold text-brand-orange-dark">All</Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-2 pt-1">
        <Button
          label={amount > 0 && !error ? `Withdraw ${naira(amount)}` : 'Withdraw'}
          disabled={!(amount > 0) || !!error}
          onPress={() => {
            onConfirm(amount);
            setDone(amount);
          }}
        />
        <Pressable onPress={onClose} hitSlop={8} className="items-center py-2">
          <Text className="text-sm font-bold text-brand-orange-dark">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Bottom sheet to pay earnings out to the saved bank account. UI only: nothing is actually sent. */
export default function WithdrawSheet({ visible, onClose, available, bank, onConfirm }: { visible: boolean; onClose: () => void; available: number; bank: Bank; onConfirm: (amount: number) => void }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Animated.View entering={FadeIn.duration(200)} className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
          <Animated.View entering={SlideInDown.duration(320)} className="gap-4 rounded-t-[32px] bg-canvas px-5 pb-10 pt-3">
            <View className="h-1.5 w-10 self-center rounded-full bg-line-strong" />
            {visible ? <Form available={available} bank={bank} onConfirm={onConfirm} onClose={onClose} /> : null}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
