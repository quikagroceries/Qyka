import { ActivityIndicator, Image, Pressable, Text, TextInput, View, type ImageSourcePropType, type TextInputProps } from 'react-native';
import { cssInterop } from 'nativewind';
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
  primary: { box: 'bg-brand-orange shadow-sm active:bg-brand-orange-dark', text: 'text-[#1A1A1A]' },
  secondary: { box: 'border-2 border-brand-green bg-surface active:bg-brand-green/10', text: 'text-brand-green' },
  neutral: { box: 'bg-sunken active:bg-line-strong', text: 'text-ink' },
} as const;

export function Button({
  label,
  onPress,
  busy,
  disabled,
  variant = 'primary',
  className,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  const v = VARIANTS[variant];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      className={cx('min-h-[44px] flex-row items-center justify-center gap-2 rounded-2xl px-5', v.box, off && 'opacity-50', className)}>
      {busy ? <ActivityIndicator color="#1A1A1A" size="small" /> : null}
      <Text className={cx('text-base font-semibold', v.text)}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, className, accent }: { children: ReactNode; className?: string; accent?: boolean }) {
  return (
    <View className={cx('gap-2 rounded-3xl border bg-surface p-5 shadow-sm', accent ? 'border-2 border-brand-orange' : 'border-line', className)}>
      {children}
    </View>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return (
    <View className="flex-1 rounded-2xl bg-sunken-2/70 p-3">
      <Text className="text-[10px] font-bold uppercase tracking-wide text-faint">{label}</Text>
      <Text className={cx('mt-1 text-xl font-extrabold', tone === 'green' ? 'text-brand-green' : 'text-ink')}>{value}</Text>
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
    <View className="overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-sm">
      <View className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-brand-orange/10" />
      {eyebrow ? (
        <View className="flex-row items-center gap-2 self-start rounded-full border border-brand-orange/30 bg-brand-orange/15 px-3 py-1">
          {live ? <View className="h-2 w-2 rounded-full bg-brand-orange" /> : null}
          <Text className="text-xs font-bold text-brand-orange-dark">{eyebrow}</Text>
        </View>
      ) : null}
      <Text className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{title}</Text>
      {body ? <Text className="mt-3 text-sm leading-relaxed text-muted">{body}</Text> : null}
      {image ? (
        <View className="mt-4 items-center">
          <Image source={image} resizeMode="contain" className="h-32 w-40" />
        </View>
      ) : null}
      {children ? <View className="mt-5">{children}</View> : null}
    </View>
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

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#9B9B9B"
      {...props}
      className={cx('rounded-2xl border border-line bg-surface px-4 py-3.5 text-base text-ink', props.className)}
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
