import { useRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputInstance } from 'react-native';

import { Text } from '@/components/Text';

/** Six boxes for the one-time code, driven by a single hidden input so paste and autofill work. */
export default function CodeBoxes({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) {
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable onPress={() => input.current?.focus()} className="flex-row justify-center gap-2.5">
      {Array.from({ length }, (_, i) => {
        const active = focused && i === Math.min(value.length, length - 1);
        return (
          <View key={i} className={'h-[60px] w-12 items-center justify-center rounded-2xl border-2 bg-surface ' + (active ? 'border-brand-orange' : 'border-line-strong')}>
            <Text className="text-2xl font-extrabold text-ink">{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        caretHidden
        className="absolute h-px w-px opacity-0"
      />
    </Pressable>
  );
}
