import { Image, Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { Button, Float } from '@/components/ui';

/** "Are you sure?" before signing out. The safe choice is the big peach button; signing out is the quieter red one. */
export default function SignOutSheet({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <Animated.View entering={SlideInDown.duration(320)} className="gap-4 rounded-t-[32px] bg-canvas px-5 pb-10 pt-3">
          <View className="h-1.5 w-10 self-center rounded-full bg-line-strong" />
          <View className="items-center gap-2">
            <Float>
              <Image source={require('../../assets/illustrations/settings.webp')} resizeMode="contain" style={{ width: 130, height: 96 }} />
            </Float>
            <Text className="text-center text-[26px] font-extrabold leading-[32px] tracking-tight text-ink">
              Sign out of{'\n'}
              <Text className="text-[26px] font-extrabold leading-[32px] tracking-tight text-brand-orange-dark">Qyka?</Text>
            </Text>
            <Text className="max-w-[300px] text-center text-base leading-6 text-muted">You&apos;ll need to sign in again to see your orders and messages.</Text>
          </View>

          <View className="gap-2">
            <Button label="Stay signed in" onPress={onClose} />
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              className="min-h-[54px] items-center justify-center rounded-full border border-danger/30 bg-surface active:bg-red-50"
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <Text className="text-base font-semibold text-danger">Sign out</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
