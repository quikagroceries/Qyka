import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Button, ErrorBanner, Field, SafeAreaView } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function SignIn() {
  const { signIn } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'identify' | 'code'>('identify');
  const [devOtp, setDevOtp] = useState<string | null>(null);
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

  // On success the session flips and the router guard moves us into the app.
  const verify = () =>
    run(async () => {
      const { access_token } = await api.verifyOtp(identifier.trim(), code.trim());
      await signIn(access_token);
    });

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center gap-6 p-6">
        <View className="gap-2">
          <Text className="text-lg font-extrabold text-brand-orange-dark">Qyka</Text>
          <Text className="text-3xl font-extrabold tracking-tight text-ink">
            {step === 'identify' ? 'Sign in' : 'Enter your code'}
          </Text>
          <Text className="text-base text-muted">
            {step === 'identify'
              ? 'Use your phone number or email. We will send you a code.'
              : `We sent a code to ${identifier.trim()}.`}
          </Text>
        </View>

        {step === 'identify' ? (
          <Field
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Phone number or email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
          />
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

        {devOtp && step === 'code' ? <Text className="text-sm text-muted">Dev code: {devOtp}</Text> : null}
        <ErrorBanner message={error} />

        <View className="gap-2">
          {step === 'identify' ? (
            <Button label="Send code" onPress={sendCode} busy={busy} disabled={!identifier.trim()} />
          ) : (
            <>
              <Button label="Verify" onPress={verify} busy={busy} disabled={code.trim().length < 4} />
              <Button
                label="Use a different number"
                variant="neutral"
                onPress={() => {
                  setStep('identify');
                  setCode('');
                  setError(null);
                }}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
