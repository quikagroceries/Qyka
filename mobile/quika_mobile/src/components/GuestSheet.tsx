import { Image, Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { Button, Float } from '@/components/ui';

const PERKS = ['Track every order to your door', 'Keep your delivery address saved', 'Chat with your agent'];

/** Bottom sheet shown when a guest taps their chip in the header: why to sign in, and the way to do it. */
export default function GuestSheet({ visible, onClose, onSignIn }: { visible: boolean; onClose: () => void; onSignIn: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <Animated.View entering={SlideInDown.duration(320)} className="gap-4 rounded-t-[32px] bg-canvas px-5 pb-10 pt-3">
          <View className="h-1.5 w-10 self-center rounded-full bg-line-strong" />
          <View className="items-center gap-2">
            <Float>
              <Image source={require('../../assets/illustrations/phone-shopping-list.webp')} resizeMode="contain" style={{ width: 150, height: 110 }} />
            </Float>
            <Text className="text-center text-[26px] font-extrabold leading-[32px] tracking-tight text-ink">
              You&apos;re browsing{'\n'}
              <Text className="text-[26px] font-extrabold leading-[32px] tracking-tight text-brand-orange-dark">as a guest</Text>
            </Text>
            <Text className="max-w-[300px] text-center text-base leading-6 text-muted">Create an account or sign in to keep your orders.</Text>
          </View>

          <View className="gap-2.5 rounded-3xl border border-line bg-surface p-4">
            {PERKS.map((p) => (
              <View key={p} className="flex-row items-center gap-3">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-orange/20">
                  <Text className="text-xs font-extrabold text-brand-orange-dark">✓</Text>
                </View>
                <Text className="flex-1 text-sm font-semibold text-ink">{p}</Text>
              </View>
            ))}
          </View>

          <View className="gap-1">
            <Button label="Sign in or create account" onPress={onSignIn} />
            <Pressable onPress={onClose} hitSlop={8} className="items-center py-2.5">
              <Text className="text-sm font-bold text-brand-orange-dark">Keep browsing</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
