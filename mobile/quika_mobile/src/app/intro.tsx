import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import Animated, { Easing, cancelAnimation, FadeInDown, FadeInUp, useSharedValue, withTiming } from 'react-native-reanimated';

import IntroBackdrop from '@/components/intro/IntroBackdrop';
import IntroSlide from '@/components/intro/IntroSlide';
import LanguageSlide from '@/components/intro/LanguageSlide';
import PageIndicator from '@/components/intro/PageIndicator';
import { SLIDES } from '@/components/intro/slides';
import { useLanguage, type LanguageCode } from '@/lib/language';
import { useSplash } from '@/lib/splash';
import SwipeButton from '@/components/SwipeButton';
import { SafeAreaView } from '@/components/ui';
import { Text } from '@/components/Text';

const SLIDE_MS = 4800;
// The language page comes first (null), then the slides.
const PAGES = [null, ...SLIDES];
const COUNT = PAGES.length;
const PADDED = [PAGES[COUNT - 1], ...PAGES, PAGES[0]];
const realIndex = (paddedIndex: number) => (paddedIndex - 1 + COUNT) % COUNT;

// An endless slideshow that opens on "Choose your language". Nothing moves until a language is
// picked; then the slides advance on their own and loop in either direction.
// The list is padded with a copy of the last slide in front and of the first behind,
// and the scroll jumps back to the real slide once it lands on a copy.
export default function Intro() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const progress = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const { chosen, choose } = useLanguage();
  const { done: splashDone } = useSplash();

  const go = () => router.push('/welcome');

  const scrollToPadded = useCallback((i: number, animated: boolean) => scroller.current?.scrollTo({ x: i * width, animated }), [width]);

  const onChoose = (code: LanguageCode) => {
    choose(code);
    setTimeout(() => {
      scrollToPadded(page + 2, true);
      setPage((page + 1) % COUNT);
    }, 450);
  };

  useEffect(() => {
    scrollToPadded(1, false);
  }, [scrollToPadded]);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (dragging || !chosen || !splashDone) return;
    progress.value = withTiming(1, { duration: SLIDE_MS, easing: Easing.linear });
    let settle: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      scrollToPadded(page + 2, true);
      setPage((page + 1) % COUNT);
      // Landed on the copy of the first slide: jump back to the real one once the slide has finished.
      if (page === COUNT - 1) settle = setTimeout(() => scrollToPadded(1, false), 750);
    }, SLIDE_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(settle);
    };
  }, [page, dragging, chosen, splashDone, progress, scrollToPadded]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(realIndex(i));
    if (i === 0) scrollToPadded(COUNT, false);
    if (i === COUNT + 1) scrollToPadded(1, false);
    setDragging(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <IntroBackdrop />

      <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between px-6 pt-2">
        <PageIndicator count={COUNT} page={page} progress={progress} />
        <Pressable onPress={go} hitSlop={12} className="flex-row items-center gap-1 py-2">
          <Text className="text-sm font-semibold text-muted">Skip</Text>
          <Text className="text-base text-muted">›</Text>
        </Pressable>
      </Animated.View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        scrollEnabled={chosen}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setDragging(true)}
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={{ flexGrow: 1 }}
        className="flex-1">
        {PADDED.map((s, i) => {
          const active = splashDone && realIndex(i) === page;
          return s ? <IntroSlide key={i} slide={s} width={width} active={active} /> : <LanguageSlide key={i} width={width} active={active} onChoose={onChoose} />;
        })}
      </ScrollView>

      <Animated.View entering={FadeInDown.delay(400).duration(500)} className="px-6 pb-4 pt-2">
        <SwipeButton label="Swipe to get started" onComplete={go} />
      </Animated.View>
    </SafeAreaView>
  );
}
