import { useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import AnglePhotos, { type Slot } from '@/components/agent/AnglePhotos';
import { AgreeCard, Bullet, ChoiceCard, FormCard, FormField, UploadField } from '@/components/agent/formParts';
import GuarantorStep, { emptyGuarantor, validateGuarantors, type Errors, type Guarantor } from '@/components/agent/GuarantorSection';
import RegistrationDone from '@/components/agent/RegistrationDone';
import SignStep, { validateSign } from '@/components/agent/SignStep';
import PhoneField, { formatNgPhone } from '@/components/auth/PhoneField';
import OrderBackdrop from '@/components/customer/OrderBackdrop';
import StepDots from '@/components/StepDots';
import { Text } from '@/components/Text';
import { Button, Field, SafeAreaView } from '@/components/ui';
import type { ProofPhoto } from '@/lib/proof';
import { useSession } from '@/lib/session';
import { isAccountNumber, isEmail, isNgMobile, isNin, isPlate, today } from '@/lib/validate';

const STEPS = ['Your details', 'Vehicle', 'Area & pay', 'Guarantors', 'Terms', 'Sign'];

// The hubs riders collect from.
const HUBS = ['Utako Ultra Modern Market', 'Wuse Market', 'Dutse Market', 'Lokogoma Market', 'Gudu Market', 'Ebeano Supermarket', 'Maitama Market'];

const VEHICLES = [
  { id: 'bicycle', label: 'Bicycle', motor: false },
  { id: 'motorbike', label: 'Motorbike', motor: true },
  { id: 'keke', label: 'Tricycle (keke)', motor: true },
  { id: 'car', label: 'Car', motor: true },
] as const;
type VehicleId = (typeof VEHICLES)[number]['id'];

// Photos of the vehicle: the outside from every side (the diagonal corners catch dents and damage the straight-on shots miss),
// and the inside, where the order actually rides.
const out = (id: string, label: string, hint: string): Slot => ({ id, label, hint, group: 'Outside' });
const inn = (id: string, label: string, hint: string): Slot => ({ id, label, hint, group: 'Inside' });

const ANGLES: Record<VehicleId, Slot[]> = {
  car: [
    out('front', 'Front', 'Straight on, whole car'),
    out('back', 'Back', 'Straight on, plate showing'),
    out('left', 'Left side', 'Side on, whole car'),
    out('right', 'Right side', 'Side on, whole car'),
    out('frontLeft', 'Front-left corner', 'From the diagonal'),
    out('backRight', 'Back-right corner', 'From the diagonal'),
    out('plate', 'Plate close-up', 'Number clear'),
    out('tyre', 'Tyre close-up', 'Show the tread'),
    inn('dash', 'Dashboard', 'Show the mileage'),
    inn('front-seats', 'Front seats', 'Both seats'),
    inn('back-seat', 'Back seat', 'Whole seat'),
    inn('boot', 'Boot', 'Open, where goods go'),
  ],
  motorbike: [
    out('front', 'Front', 'Straight on, whole bike'),
    out('back', 'Back', 'Straight on, plate showing'),
    out('left', 'Left side', 'Side on, whole bike'),
    out('right', 'Right side', 'Side on, whole bike'),
    out('frontLeft', 'Front-left corner', 'From the diagonal'),
    out('backRight', 'Back-right corner', 'From the diagonal'),
    out('plate', 'Plate close-up', 'Number clear'),
    inn('dash', 'Handlebar and meter', 'Show the mileage'),
    inn('box', 'Delivery box', 'Open, inside showing'),
  ],
  keke: [
    out('front', 'Front', 'Straight on, whole keke'),
    out('back', 'Back', 'Straight on, plate showing'),
    out('left', 'Left side', 'Side on, whole keke'),
    out('right', 'Right side', 'Side on, whole keke'),
    out('frontLeft', 'Front-left corner', 'From the diagonal'),
    out('backRight', 'Back-right corner', 'From the diagonal'),
    out('plate', 'Plate close-up', 'Number clear'),
    inn('cabin', 'Passenger area', 'Seats and floor, where goods go'),
    inn('driver', 'Driver seat and meter', 'Show the mileage'),
  ],
  bicycle: [
    out('front', 'Front', 'Straight on, whole bike'),
    out('back', 'Back', 'Straight on, whole bike'),
    out('left', 'Left side', 'Side on, whole bike'),
    out('right', 'Right side', 'Side on, whole bike'),
    inn('carrier', 'Carrier or bag', 'Where the order will ride'),
  ],
};
const anglesFor = (v: VehicleId | ''): Slot[] => (v ? ANGLES[v] : []);

type Form = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  addressProof: string | null;
  nin: string;
  idPhoto: string | null;
  selfie: string | null;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  vehicle: VehicleId | '';
  plate: string;
  vehiclePhotos: Record<string, ProofPhoto | undefined>;
  licenceNo: string;
  licencePhoto: string | null;
  papersPhoto: string | null;
  hub: string;
  areas: string;
  bank: string;
  accountNumber: string;
  accountName: string;
  g1: Guarantor;
  g2: Guarantor;
  agreeEngagement: boolean;
  agreeJob: boolean;
  agreeConduct: boolean;
  signature: string;
  date: string;
  agreeAll: boolean;
};

const REQUIRED = 'Required';
const isMotor = (v: VehicleId | '') => VEHICLES.find((x) => x.id === v)?.motor ?? false;

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
    if (!f.selfie) e.selfie = 'Take a recent selfie';
    if (!f.emergencyName.trim()) e.emergencyName = REQUIRED;
    if (!f.emergencyPhone.trim()) e.emergencyPhone = REQUIRED;
    else if (!isNgMobile(f.emergencyPhone)) e.emergencyPhone = 'Enter a valid Nigerian mobile number';
    if (!f.emergencyRelationship.trim()) e.emergencyRelationship = REQUIRED;
  }
  if (step === 1) {
    if (!f.vehicle) e.vehicle = 'Choose how you’ll ride';
    if (isMotor(f.vehicle)) {
      if (!f.plate.trim()) e.plate = REQUIRED;
      else if (!isPlate(f.plate)) e.plate = 'Enter the plate number as it appears on the vehicle';
      if (!f.licenceNo.trim()) e.licenceNo = REQUIRED;
      if (!f.licencePhoto) e.licencePhoto = 'Add a photo of your driver’s licence';
      if (!f.papersPhoto) e.papersPhoto = 'Add a photo of the vehicle papers';
    }
    if (f.vehicle && anglesFor(f.vehicle).some((a) => !f.vehiclePhotos[a.id])) e.vehiclePhotos = 'Take a photo from every angle shown';
  }
  if (step === 2) {
    if (!f.hub) e.hub = 'Choose the hub you’ll collect from';
    if (!f.areas.trim()) e.areas = 'Tell us the areas you can deliver to';
    if (!f.bank.trim()) e.bank = REQUIRED;
    if (!f.accountNumber) e.accountNumber = REQUIRED;
    else if (!isAccountNumber(f.accountNumber)) e.accountNumber = 'An account number is exactly 10 digits';
    if (!f.accountName.trim()) e.accountName = REQUIRED;
  }
  if (step === 3) Object.assign(e, validateGuarantors(f.g1, f.g2, f.phone));
  if (step === 4) {
    if (!f.agreeEngagement) e.agreeEngagement = 'Please accept to continue';
    if (!f.agreeJob) e.agreeJob = 'Please accept to continue';
    if (!f.agreeConduct) e.agreeConduct = 'Please accept to continue';
  }
  if (step === 5) Object.assign(e, validateSign(f, f.fullName));
  return e;
}

/**
 * The delivery rider registration: your details and ID, your vehicle and papers, where you'll ride and how you're paid,
 * two guarantors, the terms (each accepted on its own), then an e-signature. UI only: nothing is sent anywhere.
 */
export default function RiderRegistration({ onExit }: { onExit: () => void }) {
  const { user } = useSession();
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
    selfie: null,
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    vehicle: '',
    plate: '',
    vehiclePhotos: {},
    licenceNo: '',
    licencePhoto: null,
    papersPhoto: null,
    hub: '',
    areas: '',
    bank: '',
    accountNumber: '',
    accountName: '',
    g1: emptyGuarantor(),
    g2: emptyGuarantor(),
    agreeEngagement: false,
    agreeJob: false,
    agreeConduct: false,
    signature: '',
    date: today(),
    agreeAll: false,
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const setG = (k: 'g1' | 'g2', patch: Partial<Guarantor>) => setF((cur) => ({ ...cur, [k]: { ...cur[k], ...patch } }));

  const errors = tried ? validate(step, f) : {};
  const toTop = () => scroller.current?.scrollTo({ y: 0, animated: true });

  const next = () => {
    if (Object.keys(validate(step, f)).length > 0) {
      setTried(true);
      toTop();
      return;
    }
    setTried(false);
    if (step === STEPS.length - 1) setDone(true);
    else setStep(step + 1);
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
        linkCode={`RDR-${(f.nin || '00000000000').slice(-5)}`}
        assignLine={`You'll collect from ${f.hub} and start delivering.`}
        onExit={onExit}
      />
    );
  }

  const motor = isMotor(f.vehicle);
  const hasErrors = Object.keys(errors).length > 0;
  const heading = (top: string, accent: string, body: string) => (
    <View className="gap-1">
      <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-ink">
        {top} <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-brand-orange-dark">{accent}</Text>
      </Text>
      <Text className="text-sm leading-5 text-muted">{body}</Text>
    </View>
  );

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
            {heading('Become a delivery', 'rider', 'Read each section carefully before you complete it. This sets out the terms on which you will deliver for Qyka customers.')}

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

            <FormCard title="A recent selfie" subtitle="Taken now, facing the camera, so it matches your ID.">
              <UploadField selfie label="Selfie" uri={f.selfie} onChange={(u) => set('selfie', u)} error={errors.selfie} />
            </FormCard>

            <FormCard title="Emergency contact" subtitle="Someone we can reach if something happens while you're on the road.">
              <FormField label="Full name" error={errors.emergencyName}>
                <Field value={f.emergencyName} onChangeText={(t) => set('emergencyName', t)} placeholder="Their full name" autoCapitalize="words" />
              </FormField>
              <FormField label="Phone number" error={errors.emergencyPhone}>
                <PhoneField value={f.emergencyPhone} onChange={(t) => set('emergencyPhone', t)} />
              </FormField>
              <FormField label="Relationship to you" error={errors.emergencyRelationship}>
                <Field value={f.emergencyRelationship} onChangeText={(t) => set('emergencyRelationship', t)} placeholder="e.g. Spouse, parent, sibling" autoCapitalize="sentences" />
              </FormField>
            </FormCard>
          </>
        ) : null}

        {step === 1 ? (
          <>
            {heading('Your', 'vehicle', 'How you ride, and the papers that go with it.')}

            <FormCard title="How will you ride?">
              <View className="gap-2">
                {VEHICLES.map((v) => (
                  <ChoiceCard key={v.id} label={v.label} selected={f.vehicle === v.id} onPress={() => set('vehicle', v.id)} />
                ))}
              </View>
              {errors.vehicle ? <Text className="ml-2 text-xs font-semibold text-red-700">{errors.vehicle}</Text> : null}
            </FormCard>

            {f.vehicle ? (
              <FormCard title="Photos of your vehicle" subtitle="Outside from every side, including the corners, and inside where the order rides. Take each one now with the camera. Gallery photos aren't accepted.">
                <AnglePhotos
                  slots={anglesFor(f.vehicle)}
                  photos={f.vehiclePhotos}
                  onChange={(id, photo) => setF((cur) => ({ ...cur, vehiclePhotos: { ...cur.vehiclePhotos, [id]: photo ?? undefined } }))}
                  error={errors.vehiclePhotos}
                />
              </FormCard>
            ) : null}

            {f.vehicle && motor ? (
              <FormCard title="Your vehicle details" subtitle="Your plate, licence and papers are checked before your first delivery.">
                <FormField label="Plate number" error={errors.plate}>
                  <Field value={f.plate} onChangeText={(t) => set('plate', t.toUpperCase())} placeholder="e.g. ABC 123 DE" autoCapitalize="characters" autoCorrect={false} maxLength={12} />
                </FormField>
                <FormField label="Driver's licence number" error={errors.licenceNo}>
                  <Field value={f.licenceNo} onChangeText={(t) => set('licenceNo', t.toUpperCase())} placeholder="Licence number" autoCapitalize="characters" autoCorrect={false} />
                </FormField>
                <UploadField label="Driver's licence" hint="A clear photo of the front of your licence." uri={f.licencePhoto} onChange={(u) => set('licencePhoto', u)} error={errors.licencePhoto} />
                <UploadField label="Vehicle papers" hint="The registration papers for this vehicle." uri={f.papersPhoto} onChange={(u) => set('papersPhoto', u)} error={errors.papersPhoto} />
              </FormCard>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            {heading('Where you ride and how you', 'get paid', 'We match jobs to your hub and area, and pay you per delivery.')}

            <FormCard title="Your hub" subtitle="Where you collect orders from.">
              <View className="gap-2">
                {HUBS.map((h) => (
                  <ChoiceCard key={h} label={h} selected={f.hub === h} onPress={() => set('hub', h)} />
                ))}
              </View>
              {errors.hub ? <Text className="ml-2 text-xs font-semibold text-red-700">{errors.hub}</Text> : null}
              <FormField label="Areas you can deliver to" error={errors.areas} hint="List the areas, separated by commas.">
                <Field value={f.areas} onChangeText={(t) => set('areas', t)} placeholder="e.g. Wuse, Garki, Maitama" multiline className="min-h-[72px]" textAlignVertical="top" />
              </FormField>
            </FormCard>

            <FormCard title="Where we pay you" subtitle="Your earnings go to this bank account.">
              <FormField label="Bank" error={errors.bank}>
                <Field value={f.bank} onChangeText={(t) => set('bank', t)} placeholder="e.g. GTBank, Access, OPay" autoCapitalize="words" />
              </FormField>
              <FormField label="Account number" error={errors.accountNumber} hint="10 digits">
                <Field value={f.accountNumber} onChangeText={(t) => set('accountNumber', t.replace(/\D/g, '').slice(0, 10))} placeholder="0123456789" keyboardType="number-pad" maxLength={10} />
              </FormField>
              <FormField label="Account name" error={errors.accountName} hint="As it appears on the account">
                <Field value={f.accountName} onChangeText={(t) => set('accountName', t)} placeholder="Name on the account" autoCapitalize="words" />
              </FormField>
            </FormCard>
          </>
        ) : null}

        {step === 3 ? <GuarantorStep g1={f.g1} g2={f.g2} onChange={setG} errors={errors} /> : null}

        {step === 4 ? (
          <>
            {heading('Please read', 'carefully', 'Accept each section to continue.')}

            <AgreeCard title="Nature of engagement" label="I understand and accept" checked={f.agreeEngagement} onToggle={() => set('agreeEngagement', !f.agreeEngagement)} error={errors.agreeEngagement}>
              <Text className="text-sm leading-5 text-muted">
                You&apos;re engaged as an <Text className="font-bold text-ink">independent contractor</Text>, not an employee of Qyka, and you&apos;re paid a fixed fee per completed delivery.
              </Text>
              <Text className="text-sm leading-5 text-muted">
                Your role is to collect orders from your assigned hub and deliver them safely to the customer&apos;s address, using the jobs you claim in the Qyka rider app.
              </Text>
            </AgreeCard>

            <AgreeCard title="How a delivery works" label="I understand and agree" checked={f.agreeJob} onToggle={() => set('agreeJob', !f.agreeJob)} error={errors.agreeJob}>
              <Bullet>Claim a job, then go to the hub and show the shopkeeper your pickup code.</Bullet>
              <Bullet>Take a photo of the order as you collect it. The time and place are saved with it.</Bullet>
              <Bullet>Take the order straight to the customer&apos;s address.</Bullet>
              <Bullet>At the door, ask for the customer&apos;s code, hand over the order, and take a photo of it.</Bullet>
              <Text className="text-sm font-bold leading-5 text-ink">You never collect cash or any payment from the customer, the shop owner or the hub.</Text>
            </AgreeCard>

            <AgreeCard title="What you must not do" label="I have read and agree" checked={f.agreeConduct} onToggle={() => set('agreeConduct', !f.agreeConduct)} error={errors.agreeConduct}>
              <Bullet>Open, tamper with or swap any part of an order.</Bullet>
              <Bullet>Hand an order to anyone without the customer&apos;s code.</Bullet>
              <Bullet>Collect or ask for cash or any payment from a customer, shop owner or the hub.</Bullet>
              <Bullet>Take a job and then delay or abandon it without telling Qyka.</Bullet>
              <Bullet>Take photos that don&apos;t show the order, or at the wrong place.</Bullet>
              <Bullet>Share your rider login with anyone else.</Bullet>
              <Bullet>Do anything dishonest or fraudulent while doing your work.</Bullet>
              <Text className="text-sm leading-5 text-muted">
                If you do, Qyka may suspend or end your engagement straight away. Qyka may hold you and your named guarantors accountable for any resulting loss, and involve the police where needed.
              </Text>
            </AgreeCard>
          </>
        ) : null}

        {step === 5 ? <SignStep f={f} fullName={f.fullName} onChange={(patch) => setF((cur) => ({ ...cur, ...patch }))} errors={errors} agreement="Qyka Delivery Rider Agreement" /> : null}

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
