import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import AuthBackdrop from '@/components/auth/AuthBackdrop';
import ResendCode from '@/components/auth/ResendCode';
import CodeBoxes from '@/components/auth/CodeBoxes';
import PhoneField from '@/components/auth/PhoneField';
import Logo from '@/components/Logo';
import { Text } from '@/components/Text';
import { Button, Field, SafeAreaView } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { isNgMobile } from '@/lib/validate';

// Real sign-up: a new account needs a name and a phone number. A one-time code is texted to the phone, and verifying it creates the
// account. A short confirmation then leads straight into writing a first list (the account is opened when you tap Start my list).
export default function SignUp() {
  const router = useRouter();
  const { acceptToken } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'details' | 'code' | 'done'>('details');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');
  // The token from verifying the code. The account opens when they tap "Start my list", after the confirmation.
  const [token, setToken] = useState('');

  const target = `+234${phone.replace(/\D/g, '')}`;

  const sendCode = async () => {
    if (name.trim().length < 2) return setError('Enter your name.');
    if (!isNgMobile(phone)) return setError('Enter a valid Nigerian mobile number.');
    setBusy(true);
    setError('');
    try {
      const sent = await api.requestOtp(target);
      if (__DEV__ && sent.dev_otp) {
        setDevCode(sent.dev_otp);
        setCode(sent.dev_otp);
      }
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length < 6) return setError('Enter the 6-digit code.');
    setBusy(true);
    setError('');
    try {
      const res = await api.verifyOtp(target, code, { full_name: name.trim() });
      setToken(res.access_token);
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      await acceptToken(token);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const firstName = name.trim().split(/\s+/)[0];
  const done = step === 'done';

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <AuthBackdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="gap-6 px-5 pb-8 pt-6" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
            {done ? (
              <View className="h-11 w-11" />
            ) : (
              <Pressable
                onPress={() => (step === 'code' ? setStep('details') : router.canGoBack() ? router.back() : router.replace('/welcome'))}
                hitSlop={10}
                className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
                <Text className="text-2xl text-ink">‹</Text>
              </Pressable>
            )}
            <Logo height={34} />
            <View className="h-11 w-11" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(450)} className="items-center gap-2">
            <Image source={require('../../assets/illustrations/person-shopping-list.webp')} resizeMode="contain" style={{ width: 200, height: 150 }} />
            <Text className="text-center text-[26px] font-extrabold leading-[32px] tracking-tight text-ink">{step === 'details' ? 'Create your account' : step === 'code' ? 'Enter your code' : `You're all set${firstName ? `, ${firstName}` : ''}`}</Text>
            <Text className="max-w-[300px] text-center text-base leading-6 text-muted">
              {step === 'details'
                ? 'So your agent and rider can reach you about your order.'
                : step === 'code'
                  ? `We sent a 6-digit code to +234 ${phone || 'your phone'}.`
                  : "Your account is ready. Let's get your first list started."}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(450)} className="gap-4">
            {step === 'details' ? (
              <>
                <Field value={name} onChangeText={setName} placeholder="Full name or username" autoCapitalize="words" textContentType="name" />
                <PhoneField value={phone} onChange={setPhone} />
                {error ? <Text className="text-center text-sm font-semibold text-red-700">{error}</Text> : null}
                <Button label="Continue" busy={busy} onPress={sendCode} />
              </>
            ) : done ? (
              <>
                {error ? <Text className="text-center text-sm font-semibold text-red-700">{error}</Text> : null}
                <Button label="Start my list" busy={busy} onPress={start} />
              </>
            ) : (
              <>
                <CodeBoxes value={code} onChange={(c) => { setCode(c); setError(''); }} />
                {error ? <Text className="text-center text-sm font-semibold text-red-700">{error}</Text> : null}
                {__DEV__ && devCode ? <Text className="text-center text-xs text-faint">Dev: the code is {devCode}</Text> : null}
                <Button label="Verify and create account" busy={busy} onPress={verify} />
                <ResendCode
                  onResend={async () => {
                    const sent = await api.requestOtp(target);
                    setError('');
                    setCode(__DEV__ && sent.dev_otp ? sent.dev_otp : '');
                    if (__DEV__ && sent.dev_otp) setDevCode(sent.dev_otp);
                  }}
                />
              </>
            )}
          </Animated.View>

          {done ? null : (
            <View className="items-center gap-3">
              <View className="flex-row items-center gap-1">
                <Text className="text-sm text-muted">Already have an account?</Text>
                <Pressable onPress={() => router.dismissTo({ pathname: '/sign-in', params: { role: 'customer' } })} hitSlop={8}>
                  <Text className="text-sm font-bold text-brand-orange-dark">Sign in</Text>
                </Pressable>
              </View>
              <Text className="max-w-[280px] text-center text-xs leading-5 text-faint">By continuing you agree to Qyka&apos;s Terms and Privacy Policy.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
