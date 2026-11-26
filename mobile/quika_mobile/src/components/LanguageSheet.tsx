import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { LANGUAGES, useLanguage } from '@/lib/language';

/** Bottom sheet for switching language, using the same cards as the intro's language page. */
export default function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { language, choose } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <Animated.View entering={SlideInDown.duration(320)} className="gap-4 rounded-t-[32px] bg-canvas px-5 pb-10 pt-3">
          <View className="h-1.5 w-10 self-center rounded-full bg-line-strong" />
          <View className="items-center gap-1">
            <Text className="text-2xl font-extrabold tracking-tight text-ink">
              Choose your <Text className="text-2xl font-extrabold tracking-tight text-brand-orange-dark">language</Text>
            </Text>
            <Text className="text-sm text-muted">Pick the one you&apos;re most comfortable with.</Text>
          </View>

          <View className="gap-2.5">
            {LANGUAGES.map((l) => {
              const on = language === l.code;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => {
                    choose(l.code);
                    onClose();
                  }}
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
          </View>

          <Pressable onPress={onClose} hitSlop={8} className="items-center py-1">
            <Text className="text-sm font-bold text-brand-orange-dark">Cancel</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
