import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextProps, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' ? styles.primary : styles.ghost,
        off && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={Colors.ink} />
      ) : (
        <Text style={[styles.btnText, variant === 'ghost' && { color: Colors.primaryDark }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Title(props: TextProps) {
  return <Text {...props} style={[styles.title, props.style]} />;
}
export function Body(props: TextProps) {
  return <Text {...props} style={[styles.body, props.style]} />;
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  primary: { backgroundColor: Colors.primary },
  ghost: { backgroundColor: 'transparent' },
  btnText: { fontSize: 16, fontWeight: '700', color: Colors.ink },
  title: { fontSize: 28, fontWeight: '800', color: Colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: Colors.muted },
});

export function Card({ children, highlight, style }: { children: React.ReactNode; highlight?: boolean; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.surface,
          borderRadius: Radius.lg,
          padding: Spacing.three,
          gap: Spacing.two,
          borderWidth: highlight ? 2 : 1,
          borderColor: highlight ? Colors.primary : Colors.line,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={{ backgroundColor: '#FDECEA', borderRadius: Radius.md, padding: Spacing.three }}>
      <Text style={{ color: Colors.danger, fontSize: 14 }}>{message}</Text>
    </View>
  );
}
