import { Image, ScrollView, View, type ImageSourcePropType } from 'react-native';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import { Text } from '@/components/Text';
import { Button, SafeAreaView } from '@/components/ui';
import { useSignInPrompt } from '@/lib/signInPrompt';

/** What a guest sees on a screen that needs an account (their orders, their messages): why, and a one-tap way in. */
export default function GuestGate({ art, top, accent, body, reason }: { art: ImageSourcePropType; top: string; accent: string; body: string; reason: string }) {
  const ask = useSignInPrompt();
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="flex-grow items-center justify-center gap-5 px-5 pb-32 pt-3" showsVerticalScrollIndicator={false}>
        <Image source={art} resizeMode="contain" style={{ width: 190, height: 140 }} />
        <View className="items-center gap-2">
          <Text className="text-center text-[28px] font-extrabold leading-[34px] tracking-tight text-ink">
            {top}
            {'\n'}
            <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-brand-orange-dark">{accent}</Text>
          </Text>
          <Text className="max-w-[300px] text-center text-base leading-6 text-muted">{body}</Text>
        </View>
        <Button label="Sign in or create account" onPress={() => ask(reason)} />
      </ScrollView>
    </SafeAreaView>
  );
}
