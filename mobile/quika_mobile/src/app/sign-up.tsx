import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import AuthBackdrop from '@/components/auth/AuthBackdrop';
import ResendCode from '@/components/auth/ResendCode';
import CodeBoxes from '@/components/auth/CodeBoxes';
import GoogleLogo from '@/components/auth/GoogleLogo';
import PhoneField from '@/components/auth/PhoneField';
import Logo from '@/components/Logo';
import { Text } from '@/components/Text';
import { Button, Field, SafeAreaView } from '@/components/ui';
import { useSession } from '@/lib/session';

// UI only: the steps just move through the screens. A new account needs a name, a phone number and an email;
// once verified, a short confirmation leads straight into writing a first list.
export default function SignUp() {
  const router = useRouter();
  const { signIn, signUp } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'details' | 'code' | 'done'>('details');

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
                <Field
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
                <Button label="Continue" onPress={() => setStep('code')} />
              </>
            ) : done ? (
              <Button label="Start my list" onPress={() => signUp({ fullName: name, phone, email })} />
            ) : (
              <>
                <CodeBoxes value={code} onChange={setCode} />
                <Button label="Verify and create account" onPress={() => setStep('done')} />
                <ResendCode onResend={() => setCode('')} />
              </>
            )}
          </Animated.View>

          {step === 'details' ? (
            <>
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-line-strong" />
                <Text className="text-xs font-medium text-faint">Or continue with</Text>
                <View className="h-px flex-1 bg-line-strong" />
              </View>
              <Button label="Sign up with Google" variant="outline" icon={<GoogleLogo />} onPress={() => signIn('customer')} />
            </>
          ) : null}

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
