import { useEffect, useRef } from 'react';
import { Image, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/Text';

const MIN_MS = 1900; // long enough to read as a moment, short enough not to be a wait
const FADE_MS = 400;

/**
 * The in-app splash: Qyka's Q springs in over a growing peach glow, the line
 * under it fades up, then the whole thing fades out once the app is ready.
 * It runs in JS so it shows in Expo Go too (the native splash only exists in
 * a built app).
 */
export default function SplashOverlay({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const started = useRef(0);
  const logo = useSharedValue(0);
  const glow = useSharedValue(0);
  const tag = useSharedValue(0);
  const out = useSharedValue(1);

  useEffect(() => {
    started.current = Date.now();
    glow.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
    logo.value = withSequence(withTiming(0, { duration: 0 }), withSpring(1, { damping: 11, stiffness: 120 }));
    tag.value = withDelay(650, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [glow, logo, tag]);

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_MS - (Date.now() - started.current));
    const t1 = setTimeout(() => {
      out.value = withTiming(0, { duration: FADE_MS });
    }, wait);
    const t2 = setTimeout(onDone, wait + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready, onDone, out]);

  const wrap = useAnimatedStyle(() => ({ opacity: out.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logo.value, transform: [{ scale: 0.55 + 0.45 * logo.value }, { rotate: `${(1 - logo.value) * -12}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.55 * glow.value, transform: [{ scale: 0.4 + 1.1 * glow.value }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value, transform: [{ translateY: (1 - tag.value) * 14 }] }));

  return (
    <Animated.View pointerEvents={ready ? 'none' : 'auto'} style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }, wrap]} className="items-center justify-center bg-canvas">
      <Animated.View style={glowStyle} className="absolute h-72 w-72 rounded-full bg-brand-orange/40" />
      <Animated.View style={logoStyle}>
        <Image source={require('../../assets/images/splash-icon.png')} resizeMode="contain" className="h-44 w-44" />
      </Animated.View>
      <Animated.View style={tagStyle} className="mt-6 items-center gap-1">
        <Text className="text-4xl font-extrabold tracking-tight text-ink">Qyka</Text>
        <Text className="text-base text-muted">The market, shopped for you.</Text>
      </Animated.View>
      <View className="absolute bottom-12">
        <Text className="text-xs font-semibold uppercase tracking-widest text-faint">Fresh from the stall</Text>
      </View>
    </Animated.View>
  );
}
