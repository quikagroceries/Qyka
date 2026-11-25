import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View, useWindowDimensions, type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import SwipeButton from '@/components/SwipeButton';
import { Float, SafeAreaView } from '@/components/ui';
import { Text } from '@/components/Text';

const SLIDES: { top: string; accent: string; body: string; image: ImageSourcePropType }[] = [
  {
    top: 'Market-fresh,',
    accent: 'shopped for you.',
    body: 'Send your list and a real person walks the stalls for you.',
    image: require('../../assets/illustrations/market-cart-vendor.webp'),
  },
  {
    top: 'Real people.',
    accent: 'Real bargains.',
    body: 'Agents haggle live, send you photos and ask before they spend more.',
    image: require('../../assets/illustrations/scene-agent-laptop-delivery.webp'),
  },
  {
    top: 'Delivered to',
    accent: 'your door.',
    body: 'Collected at a trusted market hub and ridden to you, with a code only you hold.',
    image: require('../../assets/illustrations/char-rider-scooter.webp'),
  },
];

// The first screen anyone sees after the splash: three short slides, then a
// swipe to choose how they'll use Qyka. Skip jumps straight there.
export default function Intro() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const go = () => router.push('/welcome');
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="absolute -right-28 top-24 h-96 w-96 rounded-full bg-brand-orange/15" />
      <View className="absolute -left-32 bottom-40 h-80 w-80 rounded-full bg-[#F9E0CC]/60" />

      <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between px-6 pt-2">
        <View className="flex-row items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <View key={i} className={'h-1.5 rounded-full ' + (i === page ? 'w-6 bg-ink' : 'w-1.5 bg-line-strong')} />
          ))}
        </View>
        <Pressable onPress={go} hitSlop={12} className="flex-row items-center gap-1 py-2">
          <Text className="text-sm font-semibold text-muted">Skip</Text>
          <Text className="text-base text-muted">›</Text>
        </Pressable>
      </Animated.View>

      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        {SLIDES.map((s, i) => (
          <View key={i} style={{ width, flexGrow: 0, flexShrink: 0 }} className="gap-4 px-6 pb-4 pt-6">
            <Animated.View entering={FadeInDown.delay(100).duration(550)} className="items-center gap-3">
              <Text className="text-center text-[42px] font-extrabold leading-[48px] tracking-tight text-ink">
                {s.top}
                {'\n'}
                <Text className="text-[42px] font-extrabold leading-[48px] tracking-tight text-brand-orange-dark">{s.accent}</Text>
              </Text>
              <Text className="max-w-[300px] text-center text-base leading-6 text-muted">{s.body}</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(250).duration(600)} className="flex-1 items-center justify-center">
              <Float>
                <Image source={s.image} resizeMode="contain" style={{ width: width - 56, height: Math.min(380, (width - 56) * 1.05) }} />
              </Float>
              <View className="-mt-2 h-3 w-48 rounded-full bg-ink/10" />
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      <Animated.View entering={FadeInDown.delay(400).duration(500)} className="px-6 pb-4 pt-2">
        <SwipeButton label="Swipe to get started" onComplete={go} />
      </Animated.View>
    </SafeAreaView>
  );
}
