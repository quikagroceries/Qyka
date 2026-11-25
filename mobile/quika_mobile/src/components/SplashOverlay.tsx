import { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Lockup from '@/components/splash/Lockup';
import Tagline from '@/components/splash/Tagline';

const MIN_MS = 3900;
const FADE_MS = 400;
const CANVAS = '#F0ECE0';

// Runs in JS so it also shows in Expo Go (the native splash only exists in a built app).
export default function SplashOverlay({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const started = useRef(0);
  const out = useSharedValue(1);

  useEffect(() => {
    started.current = Date.now();
  }, []);

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

  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: CANVAS }, wrap]}>
      <Lockup />
      <Tagline />
    </Animated.View>
  );
}
