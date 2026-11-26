import { useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AgreeCard, Bullet, ChoiceCard, FormCard, FormField, UploadField } from '@/components/agent/formParts';
import GuarantorStep, { emptyGuarantor, validateGuarantors, type Errors, type Guarantor } from '@/components/agent/GuarantorSection';
import RegistrationDone from '@/components/agent/RegistrationDone';
import SignStep, { validateSign } from '@/components/agent/SignStep';
import PhoneField, { formatNgPhone } from '@/components/auth/PhoneField';
import OrderBackdrop from '@/components/customer/OrderBackdrop';
import StepDots from '@/components/StepDots';
import { Text } from '@/components/Text';
import { Button, Field, SafeAreaView } from '@/components/ui';
import { isEmail, isNgMobile, isNin, today } from '@/lib/validate';
import { useSession } from '@/lib/session';

const STEPS = ['Your details', 'Guarantors', 'Terms', 'Sign'];

// The markets agents can be assigned to.
const MARKETS = ['Utako Ultra Modern Market', 'Wuse Market', 'Dutse Market', 'Lokogoma Market', 'Gudu Market', 'Ebeano Supermarket', 'Maitama Market'];

type Form = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  addressProof: string | null;
  nin: string;
  idPhoto: string | null;
  market: string;
  selfie: string | null;
  g1: Guarantor;
  g2: Guarantor;
  agreeEngagement: boolean;
  agreePayment: boolean;
  agreeConduct: boolean;
  signature: string;
  date: string;
  agreeAll: boolean;
};
const REQUIRED = 'Required';

function validate(step: number, f: Form): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!f.fullName.trim()) e.fullName = REQUIRED;
    if (!f.phone.trim()) e.phone = REQUIRED;
    else if (!isNgMobile(f.phone)) e.phone = 'Enter a valid Nigerian mobile number';
    if (!f.email.trim()) e.email = REQUIRED;
    else if (!isEmail(f.email)) e.email = 'That doesn’t look like an email address';
    if (!f.address.trim()) e.address = REQUIRED;
    if (!f.addressProof) e.addressProof = 'Add a photo of a utility bill, or a picture that shows your address';
    if (!f.nin) e.nin = REQUIRED;
    else if (!isNin(f.nin)) e.nin = 'A NIN is exactly 11 digits';
    if (!f.idPhoto) e.idPhoto = 'Add a photo of your NIN card or slip, driver’s licence or voter’s card';
    if (!f.market) e.market = 'Choose the market you’ll shop in';
    if (!f.selfie) e.selfie = 'Take a recent selfie';
  }
  if (step === 1) Object.assign(e, validateGuarantors(f.g1, f.g2, f.phone));
  if (step === 2) {
    if (!f.agreeEngagement) e.agreeEngagement = 'Please accept to continue';
    if (!f.agreePayment) e.agreePayment = 'Please accept to continue';
    if (!f.agreeConduct) e.agreeConduct = 'Please accept to continue';
  }
  if (step === 3) Object.assign(e, validateSign(f, f.fullName));
  return e;
}

/**
 * The shopping agent registration, in the order of the company's form: your details and ID, two guarantors,
 * the terms (each accepted on its own), then an e-signature. UI only: nothing is sent anywhere.
 */
export default function AgentRegistration({ onExit }: { onExit: () => void }) {
  const { user, submitAgentApplication } = useSession();
  const scroller = useRef<ScrollViewInstance>(null);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState(false);
  const [f, setF] = useState<Form>({
    fullName: user?.full_name ?? '',
    phone: formatNgPhone(user?.phone ?? ''),
    email: user?.email ?? '',
    address: user?.default_delivery_address ?? '',
    addressProof: null,
    nin: '',
    idPhoto: null,
    market: '',
    selfie: null,
    g1: emptyGuarantor(),
    g2: emptyGuarantor(),
    agreeEngagement: false,
    agreePayment: false,
    agreeConduct: false,
    signature: '',
    date: today(),
    agreeAll: false,
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const setG = (k: 'g1' | 'g2', patch: Partial<Guarantor>) => setF((cur) => ({ ...cur, [k]: { ...cur[k], ...patch } }));

  // Errors only show once someone has tried to continue, then update live as they fix things.
  const errors = tried ? validate(step, f) : {};
  const toTop = () => scroller.current?.scrollTo({ y: 0, animated: true });

  const next = () => {
    if (Object.keys(validate(step, f)).length > 0) {
      setTried(true);
      toTop();
      return;
    }
    setTried(false);
    if (step === STEPS.length - 1) {
      submitAgentApplication(f.market);
      setDone(true);
    } else setStep(step + 1);
    toTop();
  };
  const back = () => {
    if (step === 0) onExit();
    else {
      setTried(false);
      setStep(step - 1);
      toTop();
    }
  };

  if (done) {
    return (
      <RegistrationDone
        name={f.fullName.trim().split(' ')[0]}
        fullName={f.fullName}
        linkCode={`AGT-${(f.nin || '00000000000').slice(-5)}`}
        assignLine={`You'll be assigned to ${f.market} and start shopping.`}
        onExit={onExit}
      />
    );
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <OrderBackdrop />
      <ScrollView ref={scroller} contentContainerClassName="gap-5 px-5 pb-12 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
          <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
            <Text className="text-2xl text-ink">‹</Text>
          </Pressable>
          <StepDots labels={STEPS} index={step} onGo={(i) => { setTried(false); setStep(i); toTop(); }} />
          <View className="h-11 w-11" />
        </Animated.View>

        {hasErrors ? (
          <View className="rounded-2xl bg-red-50 px-4 py-3">
            <Text className="text-sm font-semibold text-red-700">A few things need your attention. They&apos;re marked below.</Text>
          </View>
        ) : null}

        {step === 0 ? (
          <>
            <View className="gap-1">
              <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-ink">
                Become a shopping <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-brand-orange-dark">agent</Text>
              </Text>
              <Text className="text-sm leading-5 text-muted">Read each section carefully before you complete it. This sets out the terms on which you&apos;ll shop for Qyka customers.</Text>
            </View>

            <FormCard title="About you">
              <FormField label="Full name" error={errors.fullName}>
                <Field value={f.fullName} onChangeText={(t) => set('fullName', t)} placeholder="As on your ID" autoCapitalize="words" textContentType="name" />
              </FormField>
              <FormField label="Phone number" error={errors.phone}>
                <PhoneField value={f.phone} onChange={(t) => set('phone', t)} />
              </FormField>
              <FormField label="Email address" error={errors.email}>
                <Field value={f.email} onChangeText={(t) => set('email', t)} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
              </FormField>
            </FormCard>

            <FormCard title="Where you live" subtitle="We use this to confirm your address.">
              <FormField label="Residential address" error={errors.address}>
                <Field value={f.address} onChangeText={(t) => set('address', t)} placeholder="Street, area, landmark" multiline className="min-h-[88px]" textAlignVertical="top" />
              </FormField>
              <UploadField label="Proof of address" hint="A photo of a utility bill, or a picture that shows your address." uri={f.addressProof} onChange={(u) => set('addressProof', u)} error={errors.addressProof} />
            </FormCard>

            <FormCard title="Your identity" subtitle="Your NIN and a valid ID, so we know it's you.">
              <FormField label="NIN (National Identification Number)" error={errors.nin} hint="11 digits">
                <Field value={f.nin} onChangeText={(t) => set('nin', t.replace(/\D/g, '').slice(0, 11))} placeholder="12345678901" keyboardType="number-pad" maxLength={11} />
              </FormField>
              <UploadField label="NIN card, slip or valid ID" hint="Your NIN card or slip, a driver's licence or a voter's card." uri={f.idPhoto} onChange={(u) => set('idPhoto', u)} error={errors.idPhoto} />
            </FormCard>

            <FormCard title="Your market" subtitle="You only see orders from the market you're assigned to.">
              <View className="gap-2">
                {MARKETS.map((m) => (
                  <ChoiceCard key={m} label={m} selected={f.market === m} onPress={() => set('market', m)} />
                ))}
              </View>
              {errors.market ? <Text className="ml-2 text-xs font-semibold text-red-700">{errors.market}</Text> : null}
            </FormCard>

            <FormCard title="A recent selfie" subtitle="Taken now, facing the camera, so it matches your ID.">
              <UploadField selfie label="Selfie" uri={f.selfie} onChange={(u) => set('selfie', u)} error={errors.selfie} />
            </FormCard>
          </>
        ) : null}

        {step === 1 ? <GuarantorStep g1={f.g1} g2={f.g2} onChange={setG} errors={errors} /> : null}

        {step === 2 ? (
          <>
            <View className="gap-1">
              <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-ink">
                Please read <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-brand-orange-dark">carefully</Text>
              </Text>
              <Text className="text-sm leading-5 text-muted">Accept each section to continue.</Text>
            </View>

            <AgreeCard title="Nature of engagement" label="I understand and accept" checked={f.agreeEngagement} onToggle={() => set('agreeEngagement', !f.agreeEngagement)} error={errors.agreeEngagement}>
              <Text className="text-sm leading-5 text-muted">
                You&apos;re engaged as an <Text className="font-bold text-ink">independent contractor</Text>, not an employee of Qyka, and you&apos;re paid per completed order.
              </Text>
              <Text className="text-sm leading-5 text-muted">
                Your role is to shop for grocery items at your assigned market on behalf of Qyka customers, using the orders you receive in the Qyka agent app, and to hand completed orders to the assigned delivery courier.
              </Text>
            </AgreeCard>

            <AgreeCard title="Orders and payment" label="I understand and agree" checked={f.agreePayment} onToggle={() => set('agreePayment', !f.agreePayment)} error={errors.agreePayment}>
              <Text className="text-sm leading-5 text-muted">When you receive an order, here is what you do:</Text>
              <Bullet>Go to the shops in your assigned market and select the items as listed.</Bullet>
              <Bullet>Take a clear photo of each item with its price.</Bullet>
              <Bullet>Send the photo and price to the customer in the chat, for confirmation.</Bullet>
              <Bullet>Once they confirm, the app asks for the shop owner&apos;s account details and pays the shop owner directly.</Bullet>
              <Text className="text-sm font-bold leading-5 text-ink">You never receive, hold or transfer any money yourself, at any point.</Text>
            </AgreeCard>

            <AgreeCard title="What you must not do" label="I have read and agree" checked={f.agreeConduct} onToggle={() => set('agreeConduct', !f.agreeConduct)} error={errors.agreeConduct}>
              <Bullet>Send a photo or price that doesn&apos;t match what&apos;s actually available or being bought.</Bullet>
              <Bullet>Misrepresent the price of an item to the customer.</Bullet>
              <Bullet>Collect or ask for cash or any payment from a customer or shop owner, under any circumstances.</Bullet>
              <Bullet>Give false or incorrect shop owner account details.</Bullet>
              <Bullet>Delay or fail to send order photos or prices without telling Qyka.</Bullet>
              <Bullet>Substitute an item without the customer&apos;s or Qyka&apos;s approval.</Bullet>
              <Bullet>Share your agent login with anyone else.</Bullet>
              <Bullet>Do anything dishonest or fraudulent while doing your work.</Bullet>
              <Text className="text-sm leading-5 text-muted">
                If you do, Qyka may suspend or end your engagement straight away. Qyka may hold you and your named guarantors accountable for any resulting loss, and involve the police where needed.
              </Text>
            </AgreeCard>
          </>
        ) : null}

        {step === 3 ? <SignStep f={f} fullName={f.fullName} onChange={(patch) => setF((cur) => ({ ...cur, ...patch }))} errors={errors} agreement="Qyka Shopping Agent Agreement" /> : null}

        <View className="gap-2 pt-1">
          <Button label={step === STEPS.length - 1 ? 'Submit registration' : 'Continue'} onPress={next} />
          {step > 0 ? (
            <Pressable onPress={back} hitSlop={8} className="items-center py-2">
              <Text className="text-sm font-bold text-brand-orange-dark">Back</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
