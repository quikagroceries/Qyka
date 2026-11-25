import { ActivityIndicator, Pressable, StyleSheet, Text, type TextProps, type ViewStyle } from 'react-native';

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
