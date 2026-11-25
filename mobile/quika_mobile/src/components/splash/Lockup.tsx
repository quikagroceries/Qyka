import { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { LOGO } from '@/components/Logo';
import SlideIn from '@/components/splash/SlideIn';
import Wordmark from '@/components/splash/Wordmark';
import { GROCERIES, QYKA } from '@/components/splash/wordmarks';

const INK = '#1A1A1A';
const { icon: ICON, gap: GAP, qykaW: QYKA_W, groceriesW: GROCERIES_W, wordGap: WORD_GAP } = LOGO;
const SHIFT = (GAP + GROCERIES_W) / 2;

/** The icon springs in centered, then slides left as the wordmarks slide in from the right. */
export default function Lockup() {
  const logo = useSharedValue(0);
  const shift = useSharedValue(1);

  useEffect(() => {
    logo.value = withSequence(withTiming(0, { duration: 0 }), withSpring(1, { damping: 11, stiffness: 120 }));
    shift.value = withDelay(750, withTiming(0, { duration: 700, easing: Easing.inOut(Easing.cubic) }));
  }, [logo, shift]);

  const shiftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value * SHIFT }] }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logo.value, transform: [{ scale: 0.55 + 0.45 * logo.value }, { rotate: `${(1 - logo.value) * -12}deg` }] }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP }}>
      <Animated.View style={shiftStyle}>
        <Animated.View style={logoStyle}>
          <Image source={require('../../../assets/images/splash-icon.png')} resizeMode="contain" style={{ width: ICON, height: ICON }} />
        </Animated.View>
      </Animated.View>

      <View style={{ width: GROCERIES_W, gap: WORD_GAP }}>
        <SlideIn delay={800}>
          <Wordmark mark={QYKA} color={INK} width={QYKA_W} />
        </SlideIn>
        <SlideIn delay={1100}>
          <Wordmark mark={GROCERIES} color={INK} width={GROCERIES_W} />
        </SlideIn>
      </View>
    </View>
  );
}
