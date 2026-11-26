import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import CodeBoxes from '@/components/auth/CodeBoxes';
import PhoneField from '@/components/auth/PhoneField';
import ResendCode from '@/components/auth/ResendCode';
import { Text } from '@/components/Text';
import { Button, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { isEmail, isNgMobile } from '@/lib/validate';

type Step = 'phone' | 'code' | 'name';

/**
 * Sign in or sign up without leaving what you were doing: your phone number, the code we text you, and (only if you're new) your
 * name. When it's done `onSignedIn` runs, so the thing the person was about to do carries straight on. Nothing they typed is lost.
 */
export default function QuickSignIn({ visible, reason, onClose, onSignedIn }: { visible: boolean; reason: string; onClose: () => void; onSignedIn: () => void }) {
  const { acceptToken, updateUser } = useSession();
  const [step, setStep] = useState<Step>('phone');
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');

  // `phone` holds whichever of the two is being used: the ten digits, or the email address.
  const target = mode === 'phone' ? `+234${phone.replace(/\D/g, '')}` : phone.trim();

  const sendCode = async () => {
    if (mode === 'phone' ? !isNgMobile(phone) : !isEmail(phone)) return setError(mode === 'phone' ? 'Enter a valid Nigerian mobile number.' : 'Enter a valid email address.');
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
      const { access_token } = await api.verifyOtp(target, code);
      const who = await acceptToken(access_token);
      if (who.role !== 'customer') return onClose(); // an agent or rider account: the app opens their own home
      if (!who.full_name) {
        setStep('name');
        setBusy(false);
      } else {
        onSignedIn();
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (!name.trim()) return setError('Tell us what to call you.');
    setBusy(true);
    setError('');
    try {
      await updateUser({ full_name: name.trim() });
      onSignedIn();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const title = step === 'phone' ? 'Almost there' : step === 'code' ? 'Enter your code' : 'What should we call you?';
  const body =
    step === 'phone'
      ? `${reason} ${mode === 'phone' ? "Enter your phone number and we'll text you a code." : "Enter your email and we'll send you a code."} No password needed.`
      : step === 'code'
        ? `We sent a 6-digit code to ${mode === 'phone' ? `+234 ${phone}` : phone.trim()}.`
        : "Last step. Your agent and rider will use this name.";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View entering={SlideInDown.duration(320)} className="gap-4 rounded-t-[32px] bg-canvas px-5 pb-8 pt-3">
            <View className="h-1.5 w-10 self-center rounded-full bg-line-strong" />
            <View className="items-center gap-1.5">
              <Text className="text-center text-[24px] font-extrabold leading-[30px] tracking-tight text-ink">{title}</Text>
              <Text className="max-w-[320px] text-center text-base leading-6 text-muted">{body}</Text>
            </View>

            {step === 'phone' ? (
              <View className="gap-2">
                {mode === 'phone' ? (
                  <PhoneField value={phone} onChange={setPhone} />
                ) : (
                  <Field value={phone} onChangeText={setPhone} placeholder="Email address" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
                )}
                <Pressable
                  onPress={() => {
                    setMode(mode === 'phone' ? 'email' : 'phone');
                    setPhone('');
                    setError('');
                  }}
                  hitSlop={8}
                  className="self-end px-2">
                  <Text className="text-sm font-bold text-brand-orange-dark">{mode === 'phone' ? 'Use email' : 'Use phone'}</Text>
                </Pressable>
              </View>
            ) : null}
            {step === 'code' ? <CodeBoxes value={code} onChange={(c) => { setCode(c); setError(''); }} /> : null}
            {step === 'name' ? <Field value={name} onChangeText={(t) => { setName(t); setError(''); }} placeholder="Your name" autoCapitalize="words" textContentType="name" /> : null}

            {error ? <Text className="text-center text-sm font-semibold text-red-700">{error}</Text> : null}
            {step === 'code' && __DEV__ && devCode ? <Text className="text-center text-xs text-faint">Dev: the code is {devCode}</Text> : null}

            <Button label={step === 'phone' ? 'Send me a code' : step === 'code' ? 'Verify and continue' : 'Continue'} busy={busy} onPress={step === 'phone' ? sendCode : step === 'code' ? verify : saveName} />
            {step === 'code' ? (
              <>
                <ResendCode
                  onResend={async () => {
                    const sent = await api.requestOtp(target);
                    setError('');
                    setCode(__DEV__ && sent.dev_otp ? sent.dev_otp : '');
                    if (__DEV__ && sent.dev_otp) setDevCode(sent.dev_otp);
                  }}
                />
                <Pressable onPress={() => { setStep('phone'); setCode(''); setError(''); }} hitSlop={8} className="items-center">
                  <Text className="text-sm font-bold text-brand-orange-dark">{mode === 'phone' ? 'Wrong number?' : 'Wrong email?'}</Text>
                </Pressable>
              </>
            ) : null}
            {step === 'phone' ? <Text className="text-center text-xs leading-5 text-faint">By continuing you agree to Qyka&apos;s Terms and Privacy Policy.</Text> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
