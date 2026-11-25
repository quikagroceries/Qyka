import { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';

import { Button, Card, CodeInput, Hero, SafeAreaView, SectionHeader } from '@/components/ui';
import { ago, shortId } from '@/lib/format';
import { RIDER_ACTIVE, RIDER_POOL } from '@/lib/mock';
import type { RiderJob } from '@/lib/types';

// A rider does one job at a time (the backend enforces it), so this screen is
// either "the one job you're on" or "the pool you can take from". The job moves
// through: ready_for_pickup (show the shopkeeper your code) -> out_for_delivery
// (enter the customer's code at the door) -> handed over (customer confirms).

const riderArt = require('../../../../assets/illustrations/char-rider-scooter.webp');
const routeArt = require('../../../../assets/illustrations/delivery-map-route.webp');

const mapsUrl = (j: RiderJob) =>
  j.dropoff_latitude != null && j.dropoff_longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${j.dropoff_latitude},${j.dropoff_longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.delivery_address || '')}`;

const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;

function Pickup({ job, onRelease }: { job: RiderJob; onRelease: () => void }) {
  return (
    <>
      <Card accent className="items-center">
        <Text className="text-sm font-semibold text-muted">Show this code to the shopkeeper</Text>
        <Text className="my-2 text-5xl font-extrabold tracking-[10px] text-brand-orange-dark">{job.pickup_code}</Text>
        <Text className="text-center text-sm text-muted">They enter it to hand you the order. Don&apos;t share it with anyone else.</Text>
      </Card>
      <Card>
        <Text className="text-lg font-extrabold text-ink">{job.hub_name || 'The hub'}</Text>
        {job.market_name ? <Text className="text-muted">{job.market_name}</Text> : null}
        <Text className="text-muted">{items(job.item_count)} to collect</Text>
        {job.delivery_address ? (
          <Text className="text-sm text-muted">
            Then deliver to <Text className="font-semibold text-ink">{job.delivery_address}</Text>
          </Text>
        ) : null}
      </Card>
      <Button
        label="Can't do this one: give it back"
        variant="neutral"
        onPress={() =>
          Alert.alert('Give this job back?', 'It goes back to the pool for other riders.', [
            { text: 'Keep it', style: 'cancel' },
            { text: 'Give it back', style: 'destructive', onPress: onRelease },
          ])
        }
      />
    </>
  );
}

function Deliver({ job, onDeliver }: { job: RiderJob; onDeliver: () => void }) {
  const [code, setCode] = useState('');
  return (
    <>
      <Card>
        <Text className="text-xs font-semibold text-faint">Deliver to</Text>
        <Text className="text-lg font-extrabold text-ink">{job.customer_name || 'Customer'}</Text>
        <Text className="font-semibold text-ink">{job.delivery_address || 'No address on this order'}</Text>
        <View className="mt-2 flex-row gap-2">
          {job.customer_phone ? (
            <Button label="Call" variant="neutral" className="flex-1" onPress={() => void Linking.openURL(`tel:${job.customer_phone}`)} />
          ) : null}
          <Button label="Directions" variant="neutral" className="flex-1" onPress={() => void Linking.openURL(mapsUrl(job))} />
        </View>
      </Card>
      <Card accent className="items-stretch">
        <Text className="text-center font-semibold text-ink">Customer&apos;s code</Text>
        <Text className="text-center text-sm text-muted">Ask for the 4-digit code on their phone before you hand anything over.</Text>
        <CodeInput value={code} onChange={setCode} />
        <Button label="Confirm drop-off" onPress={onDeliver} />
      </Card>
    </>
  );
}

function PoolCard({ job, onClaim }: { job: RiderJob; onClaim: () => void }) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-lg font-extrabold text-ink">{job.hub_name || 'Market hub'}</Text>
          {job.market_name ? <Text className="text-sm text-muted">{job.market_name}</Text> : null}
        </View>
        <Text className="text-xs text-faint">Ready {ago(job.ready_at)}</Text>
      </View>
      <Text className="text-muted">
        {items(job.item_count)} · #{shortId(job.id)}
      </Text>
      <Button label="Claim this job" onPress={onClaim} />
    </Card>
  );
}

// UI only: claiming, collecting and delivering just step through local state.
type Stage = 'pool' | 'pickup' | 'deliver' | 'handed';

export default function Jobs() {
  const [stage, setStage] = useState<Stage>('pool');
  const job: RiderJob | null = stage === 'pool' ? null : RIDER_ACTIVE;
  const pool = stage === 'pool' ? RIDER_POOL : [];
  const delivering = stage === 'deliver' || stage === 'handed';
  const handedOver = stage === 'handed';

  let eyebrow = 'Jobs';
  let title = '';
  let body = '';
  if (!job) {
    eyebrow = 'Ready to ride';
    title = pool.length > 0 ? `${pool.length} job${pool.length === 1 ? '' : 's'} waiting` : 'No jobs right now';
    body = pool.length > 0 ? "Claim one to get started. It's yours until you deliver it." : 'New orders show up here the moment a hub has one ready.';
  } else if (handedOver) {
    eyebrow = `Order #${shortId(job.id)}`;
    title = 'Handed over';
    body = 'Waiting for the customer to confirm. Your fee lands once they do.';
  } else if (delivering) {
    eyebrow = `Order #${shortId(job.id)}`;
    title = `Deliver to ${job.customer_name || 'the customer'}`;
    body = "Collected from the hub. Take it to the door and get the customer's code.";
  } else {
    eyebrow = `Order #${shortId(job.id)}`;
    title = `Go to ${job.hub_name || 'the hub'}`;
    body = "Show the shopkeeper your code and they'll hand you the order.";
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <Hero eyebrow={eyebrow} live={!!job && !handedOver} title={title} body={body} image={delivering ? routeArt : riderArt} />

        {job && !delivering && <Pickup job={job} onRelease={() => setStage('pool')} />}
        {job && !delivering && <Button label="I've collected it from the hub" onPress={() => setStage('deliver')} />}
        {job && delivering && !handedOver && <Deliver job={job} onDeliver={() => setStage('handed')} />}
        {handedOver && (
          <>
            <Card className="items-center">
              <Text className="font-semibold text-brand-green">Drop-off confirmed</Text>
              <Text className="text-center text-sm text-muted">You can take a new job as soon as the customer confirms.</Text>
            </Card>
            <Button label="Back to jobs" variant="neutral" onPress={() => setStage('pool')} />
          </>
        )}
        {!job && pool.length > 0 ? (
          <>
            <SectionHeader title="Available jobs" subtitle="First to claim gets it." />
            {pool.map((j) => (
              <PoolCard key={j.id} job={j} onClaim={() => setStage('pickup')} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
