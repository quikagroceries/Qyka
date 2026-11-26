import { View } from 'react-native';

import { FormCard, FormField, UploadField } from '@/components/agent/formParts';
import PhoneField from '@/components/auth/PhoneField';
import { Text } from '@/components/Text';
import { Field } from '@/components/ui';
import { isNgMobile } from '@/lib/validate';

export type Guarantor = { name: string; phone: string; relationship: string; address: string; billPhoto: string | null };
export type Errors = Record<string, string>;
export const emptyGuarantor = (): Guarantor => ({ name: '', phone: '', relationship: '', address: '', billPhoto: null });

const REQUIRED = 'Required';
const digits = (v: string) => v.replace(/\D/g, '');

/** Checks both guarantors. `ownPhone` is the applicant's own number, which a guarantor can't use. */
export function validateGuarantors(g1: Guarantor, g2: Guarantor, ownPhone: string): Errors {
  const e: Errors = {};
  (['g1', 'g2'] as const).forEach((k) => {
    const g = k === 'g1' ? g1 : g2;
    if (!g.name.trim()) e[`${k}Name`] = REQUIRED;
    if (!g.phone.trim()) e[`${k}Phone`] = REQUIRED;
    else if (!isNgMobile(g.phone)) e[`${k}Phone`] = 'Enter a valid Nigerian mobile number';
    if (!g.relationship.trim()) e[`${k}Relationship`] = REQUIRED;
    if (!g.address.trim()) e[`${k}Address`] = REQUIRED;
    if (!g.billPhoto) e[`${k}Bill`] = 'Add a photo of their utility bill, or a picture that shows their address';
  });
  if (g1.phone && g2.phone && digits(g1.phone) === digits(g2.phone)) e.g2Phone = 'Your two guarantors need different numbers';
  if (ownPhone && g1.phone && digits(ownPhone) === digits(g1.phone)) e.g1Phone = 'This is your own number. Use your guarantor’s';
  if (ownPhone && g2.phone && digits(ownPhone) === digits(g2.phone)) e.g2Phone = 'This is your own number. Use your guarantor’s';
  return e;
}

/** The guarantors page, shared by the agent and rider registrations: two people who can vouch for you, with their address and proof of it. */
export default function GuarantorStep({ g1, g2, onChange, errors }: { g1: Guarantor; g2: Guarantor; onChange: (key: 'g1' | 'g2', patch: Partial<Guarantor>) => void; errors: Errors }) {
  return (
    <>
      <View className="gap-1">
        <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-ink">
          Your <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-brand-orange-dark">guarantors</Text>
        </Text>
        <Text className="text-sm leading-5 text-muted">Two people who can vouch for you. We need their address and proof of it, and we&apos;ll call each of them.</Text>
      </View>

      {(['g1', 'g2'] as const).map((k, i) => {
        const g = k === 'g1' ? g1 : g2;
        return (
          <FormCard key={k} title={`Guarantor ${i + 1}`}>
            <FormField label="Full name" error={errors[`${k}Name`]}>
              <Field value={g.name} onChangeText={(t) => onChange(k, { name: t })} placeholder="Their full name" autoCapitalize="words" />
            </FormField>
            <FormField label="Phone number" error={errors[`${k}Phone`]}>
              <PhoneField value={g.phone} onChange={(t) => onChange(k, { phone: t })} />
            </FormField>
            <FormField label="Relationship to you" error={errors[`${k}Relationship`]}>
              <Field value={g.relationship} onChangeText={(t) => onChange(k, { relationship: t })} placeholder="e.g. Uncle, employer, neighbour" autoCapitalize="sentences" />
            </FormField>
            <FormField label="Their residential address" error={errors[`${k}Address`]}>
              <Field value={g.address} onChangeText={(t) => onChange(k, { address: t })} placeholder="Street, area, landmark" multiline className="min-h-[88px]" textAlignVertical="top" />
            </FormField>
            <UploadField
              label="Proof of their address"
              hint="A photo of their utility bill, or a picture that shows their address."
              uri={g.billPhoto}
              onChange={(u) => onChange(k, { billPhoto: u })}
              error={errors[`${k}Bill`]}
            />
          </FormCard>
        );
      })}

      <View className="rounded-2xl bg-brand-orange/[0.12] px-4 py-3">
        <Text className="text-sm leading-5 text-ink/80">
          Each guarantor&apos;s ID, occupation and consent are collected on their own verification form, after the Qyka team calls them. You&apos;ll get a link to send them at the end.
        </Text>
      </View>
    </>
  );
}
