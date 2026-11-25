import { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import type { Slide } from '@/components/intro/slides';
import { Text } from '@/components/Text';
import { Float } from '@/components/ui';

/** One intro page. The text and hero animate in when `active` and reset when it leaves. */
export default function IntroSlide({ slide, width, active }: { slide: Slide; width: number; active: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = active ? withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })) : withTiming(0, { duration: 250 });
  }, [p, active]);

  const textStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 24 }] }));
  const imageStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.88 + 0.12 * p.value }, { translateY: (1 - p.value) * 36 }] }));

  return (
    <View style={{ width, flexGrow: 0, flexShrink: 0, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16, gap: 16 }}>
      <Animated.View style={[{ alignItems: 'center', gap: 12 }, textStyle]}>
        <Text className="text-center text-[42px] font-extrabold leading-[48px] tracking-tight text-ink">
          {slide.top}
          {'\n'}
          <Text className="text-[42px] font-extrabold leading-[48px] tracking-tight text-brand-orange-dark">{slide.accent}</Text>
        </Text>
        <Text className="max-w-[300px] text-center text-base leading-6 text-muted">{slide.body}</Text>
      </Animated.View>

      <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, imageStyle]}>
        <Float>
          <Image source={slide.image} resizeMode="contain" style={{ width: width - 56, height: Math.min(380, (width - 56) * 1.05) }} />
        </Float>
      </Animated.View>
    </View>
  );
}
