import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import AuthBackdrop from '@/components/auth/AuthBackdrop';
import Logo from '@/components/Logo';
import CodeBoxes from '@/components/auth/CodeBoxes';
import GoogleLogo from '@/components/auth/GoogleLogo';
import PhoneField from '@/components/auth/PhoneField';
import { Button, Field, SafeAreaView } from '@/components/ui';
import { Text } from '@/components/Text';
import { useSession } from '@/lib/session';
import type { Role } from '@/lib/types';

const ROLE_COPY: Record<string, { label: string; headline: string; art: number }> = {
  customer: { label: 'Customer', headline: 'Welcome back', art: require('../../assets/illustrations/person-shopping-list.webp') },
  agent: { label: 'Agent', headline: "Let's get you shopping the market", art: require('../../assets/illustrations/scene-agent-laptop-delivery.webp') },
  rider: { label: 'Rider', headline: "Let's get you riding", art: require('../../assets/illustrations/char-rider-scooter.webp') },
  shopkeeper: { label: 'Shopkeeper', headline: "Let's open your hub", art: require('../../assets/illustrations/map-pin-storefront.webp') },
};

// UI only: "Send code" and "Verify" just move through the screens, then the
// chosen role's sample account opens.
export default function SignIn() {
  const router = useRouter();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const picked = (roleParam && ROLE_COPY[roleParam] ? roleParam : 'customer') as Role;
  const copy = ROLE_COPY[picked];
  const { signIn } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [step, setStep] = useState<'identify' | 'code'>('identify');

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <AuthBackdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="gap-6 px-5 pb-8 pt-6" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
            <Pressable
              onPress={() => (step === 'code' ? setStep('identify') : router.back())}
              hitSlop={10}
              className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
              <Text className="text-2xl text-ink">‹</Text>
            </Pressable>
            <Logo height={34} />
            <View className="h-11 w-11" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(450)} className="items-center gap-2">
            <Image source={copy.art} resizeMode="contain" style={{ width: 200, height: 150 }} />
            {picked !== 'customer' ? <Text className="text-sm font-semibold text-brand-orange-dark">Signing in as a {copy.label.toLowerCase()}</Text> : null}
            <Text className="text-center text-[26px] font-extrabold leading-[32px] tracking-tight text-ink">{step === 'identify' ? copy.headline : 'Enter your code'}</Text>
            <Text className="max-w-[300px] text-center text-base leading-6 text-muted">
              {step === 'identify'
                ? mode === 'phone' ? "Enter your phone number and we'll text you a one-time code." : "Enter your email and we'll send you a one-time code."
                : `We sent a 6-digit code to ${identifier.trim() ? (mode === 'phone' ? `+234 ${identifier}` : identifier.trim()) : 'you'}.`}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(450)} className="gap-4">
            {step === 'identify' ? (
              <>
                <View className="gap-2">
                  {mode === 'phone' ? (
                    <PhoneField value={identifier} onChange={setIdentifier} />
                  ) : (
                    <Field
                      value={identifier}
                      onChangeText={setIdentifier}
                      placeholder="Email address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                    />
                  )}
                  <Pressable
                    onPress={() => {
                      setMode(mode === 'phone' ? 'email' : 'phone');
                      setIdentifier('');
                    }}
                    hitSlop={8}
                    className="self-end px-2">
                    <Text className="text-sm font-bold text-brand-orange-dark">{mode === 'phone' ? 'Use email' : 'Use phone'}</Text>
                  </Pressable>
                </View>
                <Button label="Continue" onPress={() => setStep('code')} />
              </>
            ) : (
              <>
                <CodeBoxes value={code} onChange={setCode} />
                <Button label="Verify" onPress={() => signIn(picked)} />
                <View className="flex-row items-center justify-center gap-1">
                  <Text className="text-sm text-muted">Didn&apos;t get it?</Text>
                  <Pressable hitSlop={8}>
                    <Text className="text-sm font-bold text-brand-orange-dark">Resend code</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>

          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1 bg-line-strong" />
            <Text className="text-xs font-medium text-faint">Or continue with</Text>
            <View className="h-px flex-1 bg-line-strong" />
          </View>
          <Button label="Sign in with Google" variant="outline" icon={<GoogleLogo />} onPress={() => signIn(picked)} />

          <View className="items-center gap-1">
            {picked === 'customer' ? (
              <View className="mb-6 flex-row items-center gap-1">
                <Text className="text-sm text-muted">New to Qyka?</Text>
                <Pressable onPress={() => router.push('/sign-up')} hitSlop={8}>
                  <Text className="text-sm font-bold text-brand-orange-dark">Create an account</Text>
                </Pressable>
              </View>
            ) : null}
            <Text className="text-sm text-muted">Not signing in as a {copy.label.toLowerCase()}?</Text>
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => router.replace('/welcome')} hitSlop={8}>
                <Text className="text-sm font-bold text-brand-orange-dark">Choose a different option</Text>
              </Pressable>
              {picked !== 'shopkeeper' ? (
                <>
                  <Text className="text-sm text-faint">|</Text>
                  <Pressable onPress={() => router.replace({ pathname: '/sign-in', params: { role: 'shopkeeper' } })} hitSlop={8}>
                    <Text className="text-sm font-bold text-ink">Shopkeeper</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
            <Text className="mt-4 max-w-[280px] text-center text-xs leading-5 text-faint">By continuing you agree to Qyka&apos;s Terms and Privacy Policy.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
