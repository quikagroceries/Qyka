import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/Text';
import { shortId } from '@/lib/format';

/** The order number at the top of an order page. Tap to copy it; it confirms for a moment. */
export default function OrderIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    await Clipboard.setStringAsync(shortId(id));
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Pressable onPress={copy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Copy order number" className="items-center rounded-2xl px-3 py-1 active:bg-sunken">
      <Text className="text-xs font-semibold text-muted">{copied ? 'Copied to clipboard' : 'Order · tap to copy'}</Text>
      <View className="flex-row items-center gap-1.5">
        <Text className="text-sm font-extrabold tracking-wide text-ink">#{shortId(id)}</Text>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={copied ? '#D9702F' : '#8A7F74'} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
          {copied ? <Path d="M20 6 9 17l-5-5" /> : <Path d="M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2ZM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />}
        </Svg>
      </View>
    </Pressable>
  );
}
