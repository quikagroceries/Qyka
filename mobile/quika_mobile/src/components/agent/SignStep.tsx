import { View } from 'react-native';

import { Checkbox, FormCard, FormField } from '@/components/agent/formParts';
import type { Errors } from '@/components/agent/GuarantorSection';
import { Text } from '@/components/Text';
import { Field } from '@/components/ui';
import { parseDate, sameName } from '@/lib/validate';

export type SignForm = { signature: string; date: string; agreeAll: boolean };

export function validateSign(f: SignForm, fullName: string): Errors {
  const e: Errors = {};
  if (!f.signature.trim()) e.signature = 'Required';
  else if (!sameName(f.signature, fullName)) e.signature = 'Type your full name exactly as you wrote it on the first page';
  if (!f.date.trim()) e.date = 'Required';
  else if (!parseDate(f.date)) e.date = 'Use dd/mm/yy, like 26/11/26';
  if (!f.agreeAll) e.agreeAll = 'Please confirm to submit';
  return e;
}

/** The final page of both registrations: type your name to sign, confirm the date, and agree to every section. */
export default function SignStep({ f, fullName, onChange, errors, agreement }: { f: SignForm; fullName: string; onChange: (patch: Partial<SignForm>) => void; errors: Errors; agreement: string }) {
  return (
    <>
      <View className="gap-1">
        <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-ink">
          Final <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-brand-orange-dark">agreement</Text>
        </Text>
        <Text className="text-sm leading-5 text-muted">By completing this form you confirm that you&apos;ve read, understood and agree to be bound by the full terms of the {agreement}.</Text>
      </View>

      <FormCard title="Sign here" subtitle="Your typed name is your electronic signature.">
        <FormField label="Full name as signature" error={errors.signature} hint={`Type: ${fullName.trim() || 'your full name'}`}>
          <Field value={f.signature} onChangeText={(t) => onChange({ signature: t })} placeholder="Type your full name" autoCapitalize="words" />
        </FormField>
        <FormField label="Today's date" error={errors.date} hint="dd/mm/yy">
          <Field value={f.date} onChangeText={(t) => onChange({ date: t })} placeholder="26/11/2026" keyboardType="numbers-and-punctuation" maxLength={10} />
        </FormField>
        <Checkbox label="I confirm the signature above is my agreement to every section of this form" checked={f.agreeAll} onToggle={() => onChange({ agreeAll: !f.agreeAll })} error={errors.agreeAll} />
      </FormCard>
    </>
  );
}
