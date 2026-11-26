import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';

const WAIT = 30;
const clock = (s: number) => `0:${String(s).padStart(2, '0')}`;

/**
 * "Didn't get it? Resend code". UI only: nothing is sent, but it behaves like the real thing.
 * A 30-second wait, a short "Sending…", then "Code sent" and the wait starts again.
 */
export default function ResendCode({ onResend }: { onResend?: () => void }) {
  const [seconds, setSeconds] = useState(WAIT);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const resend = () => {
    setState('sending');
    timers.current.push(
      setTimeout(() => {
        setState('sent');
        setSeconds(WAIT);
        onResend?.();
        timers.current.push(setTimeout(() => setState('idle'), 2400));
      }, 800),
    );
  };

  if (state === 'sending') return <Text className="text-center text-sm font-semibold text-muted">Sending a new code…</Text>;
  if (state === 'sent')
    return (
      <View className="flex-row items-center justify-center gap-1.5">
        <Text className="text-sm font-extrabold text-brand-army">✓</Text>
        <Text className="text-sm font-semibold text-brand-army">New code sent</Text>
      </View>
    );
  if (seconds > 0)
    return (
      <Text className="text-center text-sm text-muted">
        Didn&apos;t get it? You can resend in <Text className="font-bold text-ink">{clock(seconds)}</Text>
      </Text>
    );
  return (
    <View className="flex-row items-center justify-center gap-1">
      <Text className="text-sm text-muted">Didn&apos;t get it?</Text>
      <Pressable onPress={resend} hitSlop={8} accessibilityRole="button" className="active:opacity-60">
        <Text className="text-sm font-bold text-brand-orange-dark">Resend code</Text>
      </Pressable>
    </View>
  );
}
