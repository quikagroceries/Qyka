import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Title } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
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
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <View style={{ gap: Spacing.two }}>
          <Text style={styles.brand}>Qyka</Text>
          <Title>{step === 'identify' ? 'Sign in' : 'Enter your code'}</Title>
          <Body>
            {step === 'identify'
              ? 'Use your phone number or email. We will send you a code.'
              : `We sent a code to ${identifier.trim()}.`}
          </Body>
        </View>

        {step === 'identify' ? (
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Phone number or email"
            placeholderTextColor={Colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
          />
        ) : (
          <TextInput
            style={[styles.input, styles.code]}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={Colors.faint}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={8}
            autoFocus
          />
        )}

        {devOtp && step === 'code' ? <Body>Dev code: {devOtp}</Body> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ gap: Spacing.two }}>
          {step === 'identify' ? (
            <Button label="Send code" onPress={sendCode} loading={busy} disabled={!identifier.trim()} />
          ) : (
            <>
              <Button label="Verify" onPress={verify} loading={busy} disabled={code.trim().length < 4} />
              <Button
                label="Use a different number"
                variant="ghost"
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  body: { flex: 1, padding: Spacing.four, justifyContent: 'center', gap: Spacing.four },
  brand: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 17,
    color: Colors.ink,
  },
  code: { fontSize: 24, letterSpacing: 6, textAlign: 'center' },
  error: { color: Colors.danger, fontSize: 14 },
});
