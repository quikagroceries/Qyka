import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Text } from '@/components/Text';

/** Keeps just the 10 digits after +234: drops a leading 0 or 234, and groups them as 801 234 5678. */
export function formatNgPhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('234')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  d = d.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');
}

// Same vertical metrics for the prefix and the input, so the two line up (Android adds font padding by default).
// The input is not stretched to the field's height: the row centers it exactly like the +234 label.
const ALIGN = { includeFontPadding: false, textAlignVertical: 'center' } as const;

/** A Nigerian phone number. Looks like `Field`: fixed +234 on the left, the number formatted as you type. */
export default function PhoneField({ value, onChange }: { value: string; onChange: (formatted: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={'h-[54px] flex-row items-center rounded-full border bg-surface pl-5 pr-4 ' + (focused ? 'border-brand-orange' : 'border-line')}>
      <View className="flex-row items-center gap-2">
        <Text className="text-lg" style={ALIGN}>🇳🇬</Text>
        <Text className="text-base text-ink" style={ALIGN}>+234</Text>
      </View>
      <View className="mx-3 h-5 w-px bg-line-strong" />
      <TextInput
        value={value}
        onChangeText={(t) => onChange(formatNgPhone(t))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="801 234 5678"
        placeholderTextColor="#9B9B9B"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={13}
        className="font-body flex-1 p-0 text-base text-ink"
        style={ALIGN}
      />
    </View>
  );
}
