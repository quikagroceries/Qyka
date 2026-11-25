import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, ErrorBanner, Field, Float, SafeAreaView } from '@/components/ui';
import { Text } from '@/components/Text';
import { api, type Role, type User } from '@/lib/api';
import { useSession } from '@/lib/session';

const ROLE_COPY: Record<string, { label: string; headline: string; art: number }> = {
  customer: { label: 'Customer', headline: "Let's get you shopping", art: require('../../assets/illustrations/person-shopping-list.webp') },
  agent: { label: 'Agent', headline: "Let's get you shopping the market", art: require('../../assets/illustrations/scene-agent-laptop-delivery.webp') },
  rider: { label: 'Rider', headline: "Let's get you riding", art: require('../../assets/illustrations/char-rider-scooter.webp') },
  shopkeeper: { label: 'Shopkeeper', headline: "Let's open your hub", art: require('../../assets/illustrations/map-pin-storefront.webp') },
};

export default function SignIn() {
  const router = useRouter();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const picked = (roleParam && ROLE_COPY[roleParam] ? roleParam : 'customer') as Role;
  const copy = ROLE_COPY[picked];
  const { peek, signIn } = useSession();

  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [step, setStep] = useState<'identify' | 'code'>('identify');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      const res = await api.requestOtp(identifier.trim());
      setDevOtp(res.dev_otp); // only present outside production
      setStep('code');
    });

  const verify = () =>
    run(async () => {
      // The role is only honoured by a development backend, for brand-new accounts.
      const { access_token } = await api.verifyOtp(identifier.trim(), code.trim(), __DEV__ ? picked : undefined);
      const me = await peek(access_token);
      // Picked agent/rider/shopkeeper but this account isn't one (yet): say so
      // instead of silently dropping them into a different app.
      if (me.role !== picked && picked !== 'customer') {
        setToken(access_token);
        setMismatch(me);
        return;
      }
      await signIn(access_token); // the router guard moves us into the app
    });

  if (mismatch && token) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-1 justify-center gap-5 p-6">
          <Animated.View entering={FadeInDown.duration(400)} className="gap-3 rounded-3xl border border-line bg-surface p-6 shadow-sm">
            <Text className="text-2xl font-extrabold tracking-tight text-ink">This account isn&apos;t a {copy.label.toLowerCase()} yet</Text>
            <Text className="text-base leading-6 text-muted">
              {copy.label}s are approved by the Qyka team before they can start. Your account is signed up as a {mismatch.role}. Apply at qyka.com, or carry on as a {mismatch.role} for now.
            </Text>
            <Button label={`Continue as ${mismatch.role}`} onPress={() => void signIn(token)} />
            <Button
              label="Pick a different option"
              variant="neutral"
              onPress={() => {
                setMismatch(null);
                setToken(null);
                router.replace('/welcome');
              }}
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-orange/15" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="gap-6 px-6 pb-8 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} hitSlop={10} className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>

          <Animated.View entering={FadeInDown.duration(450)} className="items-center">
            <Float>
              <Image source={copy.art} resizeMode="contain" className="h-44 w-56" />
            </Float>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(450)} className="items-center gap-2">
            <Text className="rounded-full border border-brand-orange/30 bg-brand-orange/15 px-3 py-1 text-xs font-bold text-brand-orange-dark">{copy.label}</Text>
            <Text className="text-center text-[32px] font-extrabold leading-[38px] tracking-tight text-ink">
              {step === 'identify' ? copy.headline : 'Enter your code'}
            </Text>
            <Text className="max-w-[300px] text-center text-base leading-6 text-muted">
              {step === 'identify'
                ? mode === 'phone'
                  ? "Enter your phone number and we'll text you a code."
                  : "Enter your email and we'll send you a code."
                : `We sent a code to ${identifier.trim()}.`}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(450)} className="gap-4">
            {step === 'identify' ? (
              <>
                <View className="flex-row rounded-full bg-sunken p-1">
                  {(['phone', 'email'] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => {
                        setMode(m);
                        setIdentifier('');
                        setError(null);
                      }}
                      className={'flex-1 items-center rounded-full py-2.5 ' + (mode === m ? 'bg-surface shadow-sm' : '')}>
                      <Text className={'text-sm font-bold ' + (mode === m ? 'text-ink' : 'text-muted')}>{m === 'phone' ? 'Phone' : 'Email'}</Text>
                    </Pressable>
                  ))}
                </View>
                <Field
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={mode === 'phone' ? 'Phone number' : 'Email address'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={mode === 'phone' ? 'phone-pad' : 'email-address'}
                  textContentType={mode === 'phone' ? 'telephoneNumber' : 'emailAddress'}
                />
              </>
            ) : (
              <Field
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={8}
                autoFocus
                className="text-center text-2xl tracking-[6px]"
              />
            )}
            {devOtp && step === 'code' ? <Text className="text-center text-sm text-muted">Dev code: {devOtp}</Text> : null}
            <ErrorBanner message={error} />
            {step === 'identify' ? (
              <Button label="Send code" onPress={sendCode} busy={busy} disabled={!identifier.trim()} />
            ) : (
              <>
                <Button label="Verify" onPress={verify} busy={busy} disabled={code.trim().length < 4} />
                <Button
                  label={mode === 'phone' ? 'Use a different number' : 'Use a different email'}
                  variant="neutral"
                  onPress={() => {
                    setStep('identify');
                    setCode('');
                    setError(null);
                  }}
                />
              </>
            )}
          </Animated.View>

          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1 bg-line-strong" />
            <Text className="text-xs font-semibold text-faint">Or</Text>
            <View className="h-px flex-1 bg-line-strong" />
          </View>
          <View className="items-center gap-1">
            <Text className="text-sm text-muted">Not signing in as a {copy.label.toLowerCase()}?</Text>
            <Pressable onPress={() => router.replace('/welcome')} hitSlop={8}>
              <Text className="text-sm font-bold text-brand-orange-dark">Choose a different option</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
