import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { Button, Card, ErrorBanner, Field, Hero, SafeAreaView, SectionHeader } from '@/components/ui';
import { api, type Application, type Market } from '@/lib/api';
import { errMsg } from '@/lib/format';
import { useSession } from '@/lib/session';

const COPY = {
  agent: {
    title: 'Apply as an agent',
    body: 'Shop a market for customers and earn on every order. We check your ID before your first run.',
    image: require('../../../../assets/illustrations/scene-agent-laptop-delivery.webp'),
  },
  rider: {
    title: 'Apply as a rider',
    body: 'Collect from a market hub and deliver to customers. Claim jobs when you want.',
    image: require('../../../../assets/illustrations/char-rider-scooter.webp'),
  },
} as const;

// Apply to become an agent or a rider. Who you are comes from the account you
// signed in with, so there is nothing to retype but where you'd work.
export default function Apply() {
  const router = useRouter();
  const { user } = useSession();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const role = (roleParam === 'rider' ? 'rider' : 'agent') as 'agent' | 'rider';
  const copy = COPY[role];

  const [name, setName] = useState(user?.full_name ?? '');
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [marketId, setMarketId] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState<Application | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.markets().then(setMarkets).catch((e) => setError(errMsg(e)));
    api
      .myApplications()
      .then((list) => setExisting(list.find((a) => a.kind === role && a.status === 'pending') ?? null))
      .catch(() => setExisting(null));
  }, [role]);

  const phone = user?.phone ?? '';
  const canSend =
    !!name.trim() && !!phone && (role === 'agent' ? !!marketId : !!(marketId || area.trim())) && !busy;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (role === 'agent') {
        await api.applyAsAgent({ market_id: marketId, note: note.trim() || null });
      } else {
        await api.applyPublic({
          kind: 'rider',
          full_name: name.trim(),
          phone,
          ...(marketId ? { market_id: marketId } : {}),
          ...(area.trim() ? { area: area.trim() } : {}),
          ...(vehicle.trim() ? { vehicle: vehicle.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
      }
      setSent(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const back = () => router.replace('/customer');

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12" keyboardShouldPersistTaps="handled">
        <Pressable onPress={back} className="self-start py-1">
          <Text className="text-sm font-semibold text-muted">← Back</Text>
        </Pressable>

        <Hero eyebrow="Join Qyka" title={copy.title} body={copy.body} image={copy.image} />

        {sent || existing ? (
          <Card className="items-center gap-2 py-6">
            <Text className="text-lg font-extrabold text-ink">{sent ? 'Application received' : 'Application pending'}</Text>
            <Text className="text-center text-sm text-muted">
              {sent ? "We'll call " : 'We have your application and will call '}
              <Text className="font-semibold text-ink">{phone}</Text> to verify you and get you started.
            </Text>
            <Button label="Back to my account" variant="neutral" className="mt-2" onPress={back} />
          </Card>
        ) : existing === undefined ? (
          <Text className="text-center text-muted">Checking…</Text>
        ) : (
          <>
            <Card>
              <SectionHeader title="Your details" subtitle="From your account. Change your name if it's wrong." />
              <Field value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" textContentType="name" />
              <View className="rounded-full border border-line bg-sunken px-5 py-4">
                <Text className="text-base text-muted">{phone || 'No phone on this account'}</Text>
              </View>
              {!phone ? <Text className="text-xs text-faint">Add a phone number to your account to apply.</Text> : null}
            </Card>

            <Card>
              <SectionHeader
                title={role === 'agent' ? 'Which market do you know best?' : 'Where would you ride?'}
                subtitle={role === 'agent' ? 'You only see orders from this market.' : 'Pick a market, or describe your area below.'}
              />
              {markets === null && !error ? <Text className="text-muted">Loading markets…</Text> : null}
              <View className="gap-2">
                {(markets ?? []).map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setMarketId(marketId === m.id ? '' : m.id)}
                    className={'rounded-2xl border-2 px-4 py-3 ' + (marketId === m.id ? 'border-brand-orange bg-brand-orange/10' : 'border-line bg-surface')}>
                    <Text className="font-bold text-ink">{m.name}</Text>
                    {m.city ? <Text className="text-xs text-muted">{m.city}</Text> : null}
                  </Pressable>
                ))}
              </View>
              {role === 'rider' ? (
                <>
                  <Field value={area} onChangeText={setArea} placeholder="Area you'd cover (e.g. Yaba, Surulere)" />
                  <Field value={vehicle} onChangeText={setVehicle} placeholder="Your vehicle (bike, keke, car)" />
                </>
              ) : null}
              <Field value={note} onChangeText={setNote} placeholder={role === 'agent' ? 'Anything we should know? (optional)' : 'Anything else? (optional)'} multiline className="min-h-[72px]" />
            </Card>

            <ErrorBanner message={error} />
            <Button label={`${copy.title} →`} busy={busy} disabled={!canSend} onPress={() => void submit()} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
