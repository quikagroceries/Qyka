import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { Button, Card, Field, Hero, SafeAreaView, SectionHeader } from '@/components/ui';
import { MARKETS } from '@/lib/mock';
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
  const [marketId, setMarketId] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const phone = user?.phone ?? '';

  const back = () => router.replace('/customer');

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12" keyboardShouldPersistTaps="handled">
        <Pressable onPress={back} className="self-start py-1">
          <Text className="text-sm font-semibold text-muted">← Back</Text>
        </Pressable>

        <Hero eyebrow="Join Qyka" title={copy.title} body={copy.body} image={copy.image} />

        {sent ? (
          <Card className="items-center gap-2 py-6">
            <Text className="text-lg font-extrabold text-ink">Application received</Text>
            <Text className="text-center text-sm text-muted">
              We&apos;ll call 
              <Text className="font-semibold text-ink">{phone}</Text> to verify you and get you started.
            </Text>
            <Button label="Back to my account" variant="neutral" className="mt-2" onPress={back} />
          </Card>
        ) : (
          <>
            <Card>
              <SectionHeader title="Your details" subtitle="From your account. Change your name if it's wrong." />
              <Field value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" textContentType="name" />
              <View className="rounded-full border border-line bg-sunken px-5 py-4">
                <Text className="text-base text-muted">{phone || 'No phone on this account'}</Text>
              </View>
            </Card>

            <Card>
              <SectionHeader
                title={role === 'agent' ? 'Which market do you know best?' : 'Where would you ride?'}
                subtitle={role === 'agent' ? 'You only see orders from this market.' : 'Pick a market, or describe your area below.'}
              />
              <View className="gap-2">
                {MARKETS.map((m) => (
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

            <Button label={`${copy.title} →`} onPress={() => setSent(true)} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
