import { useEffect, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/Text';

const KNOB = 56;
const PAD = 4;

/**
 * "Swipe to get started": drag the knob across the pill. Releasing past
 * three-quarters completes it; anything less springs back.
 */
export default function SwipeButton({ label, onComplete }: { label: string; onComplete: () => void }) {
  const [trackW, setTrackW] = useState(0);
  const x = useSharedValue(0);
  const maxSV = useSharedValue(0);
  const done = useRef(false);
  useEffect(() => {
    maxSV.value = Math.max(0, trackW - KNOB - PAD * 2);
  }, [trackW, maxSV]);

  // The refs are only read inside the gesture callbacks, never during render.
  /* eslint-disable react-hooks/refs */
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (!done.current) x.value = Math.min(maxSV.value, Math.max(0, g.dx));
      },
      onPanResponderRelease: (_, g) => {
        if (done.current) return;
        if (g.dx > maxSV.value * 0.75 && maxSV.value > 0) {
          done.current = true;
          x.value = withTiming(maxSV.value, { duration: 120 });
          onComplete();
          // Come back to rest in case the user returns to this screen.
          setTimeout(() => {
            done.current = false;
            x.value = withSpring(0);
          }, 600);
        } else {
          x.value = withSpring(0);
        }
      },
    }),
  );
  /* eslint-enable react-hooks/refs */

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const hint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, Math.max(1, maxSV.value * 0.6)], [1, 0], Extrapolation.CLAMP) }));
  const fill = useAnimatedStyle(() => ({ width: x.value + KNOB + PAD * 2 }));

  return (
    <View
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      className="h-16 justify-center overflow-hidden rounded-full bg-brand-orange"
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Animated.View style={fill} className="absolute left-0 top-0 h-16 rounded-full bg-brand-orange-dark/35" />
      <Animated.View style={hint} className="absolute inset-0 items-center justify-center pl-12">
        <Text className="text-base font-bold text-ink">{label}</Text>
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={[knob, { marginLeft: PAD }]}
        className="h-14 w-14 items-center justify-center rounded-full bg-surface shadow-sm">
        <Text className="text-xl font-extrabold text-brand-orange-dark">»</Text>
      </Animated.View>
    </View>
  );
}
