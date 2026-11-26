import { ActivityIndicator, Image, Pressable, TextInput, View, type ImageSourcePropType, type TextInputProps } from 'react-native';
import { Text } from '@/components/Text';
import { cssInterop } from 'nativewind';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { illustrationForItem } from '@/lib/foodVisuals';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

// react-native-safe-area-context's view doesn't take className on its own.
cssInterop(SafeAreaView, { className: 'style' });
export { SafeAreaView };

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// Class strings below are lifted from the web components in
// frontend/src/components/ui (Button, Card, StatTile, HeroBanner) so the app
// reads as the web's mobile view.

const VARIANTS = {
  primary: { box: 'bg-brand-orange active:bg-brand-orange-dark', text: 'text-[#1A1A1A]' },
  secondary: { box: 'border-2 border-brand-army bg-surface active:bg-brand-green/10', text: 'text-brand-army' },
  neutral: { box: 'bg-sunken active:bg-line-strong', text: 'text-ink' },
  outline: { box: 'border border-line-strong bg-surface active:bg-sunken', text: 'text-ink' },
} as const;

export function Button({
  label,
  onPress,
  busy,
  disabled,
  variant = 'primary',
  icon,
  className,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: keyof typeof VARIANTS;
  icon?: ReactNode;
  className?: string;
}) {
  const v = VARIANTS[variant];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      className={cx('min-h-[54px] flex-row items-center justify-center gap-2 rounded-full px-6', v.box, off && 'opacity-50', className)}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      {busy ? <ActivityIndicator color="#1A1A1A" size="small" /> : icon}
      <Text className={cx('text-base font-semibold', v.text)}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, className, accent }: { children: ReactNode; className?: string; accent?: boolean }) {
  return (
    <Animated.View entering={FadeInDown.duration(380)} className={cx('gap-2 rounded-3xl border bg-surface p-5 shadow-sm', accent ? 'border-2 border-brand-orange' : 'border-line', className)}>
      {children}
    </Animated.View>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return (
    <View className="flex-1 rounded-2xl bg-sunken-2/70 p-3">
      <Text className="text-[10px] font-bold uppercase tracking-wide text-faint">{label}</Text>
      <Text className={cx('mt-1 text-xl font-extrabold', tone === 'green' ? 'text-brand-army' : 'text-ink')}>{value}</Text>
    </View>
  );
}

/** The page hero from web's HeroBanner: pill, headline, body, illustration. */
export function Hero({
  eyebrow,
  live,
  title,
  body,
  image,
  children,
}: {
  eyebrow?: string;
  live?: boolean;
  title: string;
  body?: string;
  image?: ImageSourcePropType;
  children?: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(450)} className="overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-sm">
      <View className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-brand-orange/10" />
      <View className="absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-[#F9E0CC]/50" />
      {eyebrow ? (
        <View className="flex-row items-center gap-2 self-start rounded-full border border-brand-orange/30 bg-brand-orange/15 px-3 py-1">
          {live ? <View className="h-2 w-2 rounded-full bg-brand-orange" /> : null}
          <Text className="text-xs font-bold text-brand-orange-dark">{eyebrow}</Text>
        </View>
      ) : null}
      <Text className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{title}</Text>
      {body ? <Text className="mt-3 text-sm leading-relaxed text-muted">{body}</Text> : null}
      {image ? (
        <Float className="mt-4 items-center">
          <Image source={image} resizeMode="contain" className="h-32 w-40" />
        </Float>
      ) : null}
      {children ? <View className="mt-5">{children}</View> : null}
    </Animated.View>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-lg font-extrabold text-ink">{title}</Text>
      {subtitle ? <Text className="text-sm text-muted">{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View className="rounded-2xl bg-red-50 px-4 py-3">
      <Text className="text-sm text-red-600">{message}</Text>
    </View>
  );
}

export function Field({ onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor="#9B9B9B"
      {...props}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className={cx(
        'font-body border bg-surface px-5 py-4 text-base text-ink',
        focused ? 'border-brand-orange' : 'border-line',
        props.multiline ? 'rounded-3xl' : 'rounded-full',
        props.className,
      )}
    />
  );
}

/** Big centred digit entry for the 4-digit handover codes. */
export function CodeInput({ value, onChange, length = 4 }: { value: string; onChange: (v: string) => void; length?: number }) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
      keyboardType="number-pad"
      maxLength={length}
      placeholder={'0'.repeat(length)}
      placeholderTextColor="#9B9B9B"
      className="rounded-2xl bg-sunken py-3.5 text-center text-3xl font-extrabold tracking-[12px] text-ink"
    />
  );
}

const SUCCESS = new Set(['paid', 'delivered', 'closed']);
const PROBLEM = new Set(['cancelled', 'cancelled_unpaid', 'disputed']);

/** Same semantics as web's StatusBadge: green success, red problems, peach in progress. */
export function StatusBadge({ status }: { status: string }) {
  const problem = PROBLEM.has(status);
  const success = SUCCESS.has(status);
  const box = problem ? 'bg-red-50' : success ? 'bg-brand-green/10' : 'bg-brand-orange/15';
  const text = problem ? 'text-red-700' : success ? 'text-brand-army' : 'text-brand-orange-dark';
  const dot = problem ? 'bg-red-600' : success ? 'bg-brand-army' : 'bg-brand-orange';
  return (
    <View className={cx('flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1', box)}>
      <View className={cx('h-1.5 w-1.5 rounded-full', dot)} />
      <Text className={cx('text-xs font-bold capitalize', text)}>{status.replaceAll('_', ' ')}</Text>
    </View>
  );
}

/** Photo, or the person's initial on a sunken disc (web's Avatar fallback). */
export function Avatar({ uri, name, className }: { uri?: string | null; name?: string | null; className?: string }) {
  if (uri) return <Image source={{ uri }} className={cx('h-10 w-10 rounded-full bg-sunken', className)} />;
  return (
    <View className={cx('h-10 w-10 items-center justify-center rounded-full bg-brand-orange/15', className)}>
      <Text className="text-base font-bold text-brand-orange-dark">{(name || '?').trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/** A small illustrated tile for an item, like the web's list rows. */
export function ItemArt({ name, className }: { name: string; className?: string }) {
  return (
    <View className={cx('h-9 w-9 items-center justify-center rounded-xl bg-sunken-2 p-1', className)}>
      <Image source={illustrationForItem(name)} resizeMode="contain" className="h-full w-full" />
    </View>
  );
}

/** Empty states: a picture, a headline and a line of help, on a card. */
export function EmptyState({ image, title, subtitle }: { image: ImageSourcePropType; title: string; subtitle?: string }) {
  return (
    <Card className="items-center py-6">
      <Image source={image} resizeMode="contain" className="h-28 w-36" />
      <Text className="mt-1 text-base font-bold text-ink">{title}</Text>
      {subtitle ? <Text className="text-center text-sm text-muted">{subtitle}</Text> : null}
    </Card>
  );
}

/** A gentle up-and-down drift, so illustrations feel alive instead of pasted on. */
export function Float({ children, className }: { children: ReactNode; className?: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })), -1);
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={style} className={className}>
      {children}
    </Animated.View>
  );
}
