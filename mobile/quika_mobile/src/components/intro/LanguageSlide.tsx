import { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { Float } from '@/components/ui';
import { LANGUAGES, useLanguage, type LanguageCode } from '@/lib/language';

/** The first page of the intro: tapping a language chooses it and starts the slideshow. */
export default function LanguageSlide({ width, active, onChoose }: { width: number; active: boolean; onChoose: (code: LanguageCode) => void }) {
  const { language, chosen } = useLanguage();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = active ? withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })) : withTiming(0, { duration: 250 });
  }, [p, active]);

  const textStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 24 }] }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 36 }] }));

  return (
    <View style={{ width, flexGrow: 0, flexShrink: 0, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16, gap: 20 }}>
      <Animated.View style={[{ alignItems: 'center', gap: 12 }, textStyle]}>
        <Text className="text-center text-[42px] font-extrabold leading-[48px] tracking-tight text-ink">
          Choose your{'\n'}
          <Text className="text-[42px] font-extrabold leading-[48px] tracking-tight text-brand-orange-dark">language.</Text>
        </Text>
        <Text className="max-w-[300px] text-center text-base leading-6 text-muted">Pick the one you&apos;re most comfortable with.</Text>
      </Animated.View>

      <Animated.View style={[{ gap: 10 }, bodyStyle]}>
        {LANGUAGES.map((l) => {
          const on = chosen && language === l.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => onChoose(l.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              className={'flex-row items-center justify-between rounded-3xl border-2 px-5 py-4 active:opacity-80 ' + (on ? 'border-brand-orange bg-brand-orange/10' : 'border-line bg-surface')}>
              <View>
                <Text className="text-xl font-extrabold text-ink">{l.native}</Text>
                <Text className="text-sm text-muted">{l.description}</Text>
              </View>
              <View className={'h-7 w-7 items-center justify-center rounded-full border-2 ' + (on ? 'border-brand-orange-dark bg-brand-orange-dark' : 'border-line-strong')}>
                {on ? <Text className="text-sm font-extrabold text-white">✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </Animated.View>

      <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, bodyStyle]}>
        <Float>
          <Image source={require('../../../assets/illustrations/agent-customer-conversation.webp')} resizeMode="contain" style={{ width: width - 120, height: (width - 120) * 0.8 }} />
        </Float>
      </Animated.View>
    </View>
  );
}
