import { useEffect, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
  // The dark-peach fill is the knob plus PAD on every side, growing as the knob moves.
  const fill = useAnimatedStyle(() => ({ width: x.value + KNOB + PAD * 2 }));

  return (
    <View
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      style={{ height: KNOB + PAD * 2 }}
      className="justify-center overflow-hidden rounded-full bg-brand-orange"
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Animated.View style={[fill, { position: 'absolute', left: 0, top: 0, height: KNOB + PAD * 2 }]} className="rounded-full bg-brand-orange-dark/35" />
      <Animated.View style={hint} className="absolute inset-0 items-center justify-center pl-12">
        <Text className="text-base font-bold text-ink">{label}</Text>
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={[knob, { position: 'absolute', left: PAD, top: PAD, width: KNOB, height: KNOB }]}
        className="items-center justify-center rounded-full bg-surface shadow-sm">
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12h14M13 6l6 6-6 6" stroke="#D9702F" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}
