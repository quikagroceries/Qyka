import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import Logo from '@/components/Logo';
import { SafeAreaView } from '@/components/ui';
import { useSession } from '@/lib/session';
import WelcomeBackdrop from '@/components/welcome/WelcomeBackdrop';
import { Text } from '@/components/Text';

export type ChosenRole = 'customer' | 'agent' | 'rider';

const ROLES: { role: ChosenRole; title: string; blurb: string; image: ImageSourcePropType; tint: string }[] = [
  {
    role: 'customer',
    title: 'I want groceries',
    blurb: 'Send your list. A real person shops the market for you and brings it home.',
    image: require('../../assets/illustrations/person-shopping-list.webp'),
    tint: 'bg-brand-orange/15',
  },
  {
    role: 'agent',
    title: 'I shop the market',
    blurb: 'Walk the stalls, bargain live for customers, and earn on every order.',
    image: require('../../assets/illustrations/scene-agent-laptop-delivery.webp'),
    tint: 'bg-brand-green/15',
  },
  {
    role: 'rider',
    title: 'I deliver orders',
    blurb: 'Pick up from a market hub and ride orders to customers. Claim jobs when you want.',
    image: require('../../assets/illustrations/char-rider-scooter.webp'),
    tint: 'bg-gold/40',
  },
];

// First screen for anyone signed out: pick how you'll use Qyka, then sign in.
export default function Welcome() {
  const router = useRouter();
  const { continueAsGuest } = useSession();
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <WelcomeBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-8 pt-6" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(500)} className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} hitSlop={10} className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>
          <Logo height={34} />
          <View className="h-11 w-11" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center gap-2">
          <Text className="text-center text-[34px] font-extrabold leading-[40px] tracking-tight text-ink">
            How will you{'\n'}
            <Text className="text-[34px] font-extrabold leading-[40px] tracking-tight text-brand-orange-dark">use Qyka?</Text>
          </Text>
          <Text className="max-w-[300px] text-center text-base leading-6 text-muted">Pick one to get started. You can always sign in again as someone else.</Text>
        </Animated.View>

        {ROLES.map((r, i) => (
          <Animated.View key={r.role} entering={FadeInDown.delay(250 + i * 120).duration(500)}>
            <Pressable
              onPress={() => (r.role === 'customer' ? continueAsGuest() : router.push({ pathname: '/sign-in', params: { role: r.role } }))}
              className="flex-row items-center gap-4 overflow-hidden rounded-3xl border border-line bg-surface p-4 shadow-sm active:bg-surface-2"
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <View className={`h-[92px] w-[92px] items-center justify-center rounded-2xl ${r.tint}`}>
                <Image source={r.image} resizeMode="contain" className="h-[76px] w-[76px]" />
              </View>
              <View className="flex-1 gap-1.5">
                <Text className="text-xl font-extrabold tracking-tight text-ink">{r.title}</Text>
                <Text className="text-sm leading-5 text-muted">{r.blurb}</Text>
              </View>
              <Text className="text-2xl text-brand-orange-dark">›</Text>
            </Pressable>
          </Animated.View>
        ))}

        <Animated.View entering={FadeInDown.delay(650).duration(500)} className="flex-row items-center justify-center gap-1 pt-6">
          <Text className="text-sm text-muted">Already have an account?</Text>
          <Pressable onPress={() => router.push('/sign-in')} hitSlop={8}>
            <Text className="text-sm font-bold text-brand-orange-dark">Sign in</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
