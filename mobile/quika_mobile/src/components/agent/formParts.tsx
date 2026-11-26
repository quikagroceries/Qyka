import { useState, type ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { Button } from '@/components/ui';
import { pickPhoto } from '@/lib/pickPhoto';

/** A label above a field, with the error (if any) under it in red. */
export function FormField({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">{label}</Text>
      {children}
      {error ? <Text className="ml-2 text-xs font-semibold text-red-700">{error}</Text> : hint ? <Text className="ml-2 text-xs text-faint">{hint}</Text> : null}
    </View>
  );
}

/** A white section card with a title, like the cards across the app. */
export function FormCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View className="gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <View className="gap-0.5">
        <Text className="text-lg font-extrabold tracking-tight text-ink">{title}</Text>
        {subtitle ? <Text className="text-sm leading-5 text-muted">{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** A photo the person must provide. Documents can be photographed or picked; a selfie is live from the front camera only. */
export function UploadField({
  label,
  hint,
  uri,
  onChange,
  error,
  selfie,
}: {
  label: string;
  hint?: string;
  uri: string | null;
  onChange: (uri: string | null) => void;
  error?: string;
  selfie?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const take = async (source: 'camera' | 'library') => {
    setBusy(true);
    const picked = await pickPhoto(source, { front: selfie });
    setBusy(false);
    if (picked) onChange(picked);
  };
  return (
    <FormField label={label} error={error} hint={hint}>
      {uri ? (
        <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface-2 p-2.5">
          <Image source={{ uri }} className={selfie ? 'h-20 w-20 rounded-full bg-sunken' : 'h-20 w-20 rounded-xl bg-sunken'} />
          <View className="flex-1 gap-2">
            <Text className="text-sm font-semibold text-brand-army">✓ Added</Text>
            <View className="flex-row gap-2">
              <Pressable onPress={() => take('camera')} className="rounded-full border border-line-strong bg-surface px-3 py-1.5 active:bg-sunken">
                <Text className="text-xs font-bold text-ink">{selfie ? 'Retake' : 'Retake photo'}</Text>
              </Pressable>
              <Pressable onPress={() => onChange(null)} className="rounded-full border border-line-strong bg-surface px-3 py-1.5 active:bg-sunken">
                <Text className="text-xs font-bold text-red-700">Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View className={'gap-2 rounded-2xl border-2 border-dashed bg-surface-2 p-3 ' + (error ? 'border-red-300' : 'border-brand-orange/50')}>
          <View className="flex-row gap-2">
            <Button label={busy ? 'Opening…' : selfie ? 'Take a selfie' : 'Take photo'} className="flex-1" disabled={busy} onPress={() => take('camera')} />
            {selfie ? null : <Button label="Upload" variant="outline" className="flex-1" disabled={busy} onPress={() => take('library')} />}
          </View>
        </View>
      )}
    </FormField>
  );
}

/** A read-then-accept block: the text, and a checkbox row to agree to it. */
export function AgreeCard({ title, children, label, checked, onToggle, error }: { title: string; children: ReactNode; label: string; checked: boolean; onToggle: () => void; error?: string }) {
  return (
    <View className="gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <Text className="text-lg font-extrabold tracking-tight text-ink">{title}</Text>
      <View className="gap-2">{children}</View>
      <Checkbox label={label} checked={checked} onToggle={onToggle} error={error} />
    </View>
  );
}

export function Checkbox({ label, checked, onToggle, error }: { label: string; checked: boolean; onToggle: () => void; error?: string }) {
  return (
    <View className="gap-1">
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        className={'flex-row items-center gap-3 rounded-2xl border-2 px-4 py-3 active:opacity-80 ' + (checked ? 'border-brand-orange bg-brand-orange/10' : error ? 'border-red-300 bg-surface' : 'border-line bg-surface')}>
        <View className={'h-7 w-7 items-center justify-center rounded-lg border-2 ' + (checked ? 'border-brand-orange bg-brand-orange' : 'border-line-strong bg-surface')}>
          {checked ? <Text className="font-extrabold text-ink">✓</Text> : null}
        </View>
        <Text className="flex-1 text-sm font-bold leading-5 text-ink">{label}</Text>
      </Pressable>
      {error ? <Text className="ml-2 text-xs font-semibold text-red-700">{error}</Text> : null}
    </View>
  );
}

/** One option in a pick-one list. */
export function ChoiceCard({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={'flex-row items-center justify-between rounded-2xl border-2 px-4 py-3.5 active:opacity-80 ' + (selected ? 'border-brand-orange bg-brand-orange/10' : 'border-line bg-surface')}>
      <Text className="flex-1 text-base font-bold text-ink">{label}</Text>
      <View className={'h-6 w-6 items-center justify-center rounded-full border-2 ' + (selected ? 'border-brand-orange-dark bg-brand-orange-dark' : 'border-line-strong')}>
        {selected ? <Text className="text-xs font-extrabold text-white">✓</Text> : null}
      </View>
    </Pressable>
  );
}

/** A bullet in a list of rules. */
export function Bullet({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row gap-2.5">
      <View className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-orange" />
      <Text className="flex-1 text-sm leading-5 text-muted">{children}</Text>
    </View>
  );
}
