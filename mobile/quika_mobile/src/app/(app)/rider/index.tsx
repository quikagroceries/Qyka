import { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import GoodsPhotos from '@/components/GoodsPhotos';
import PageHeader from '@/components/PageHeader';
import StatTiles from '@/components/StatTiles';
import { Text } from '@/components/Text';
import { Button, CodeInput, Float, SafeAreaView } from '@/components/ui';
import { ago, naira, shortId, splitAccent } from '@/lib/format';
import type { ProofPhoto } from '@/lib/proof';
import { rider, useRider } from '@/lib/riderStore';
import type { RiderJob } from '@/lib/types';

// A rider does one job at a time (the backend enforces it), so this screen is
// either "the one job you're on" or "the pool you can take from". The job moves
// through: ready_for_pickup (show the shopkeeper your code) -> out_for_delivery
// (enter the customer's code at the door) -> handed over (customer confirms).

const riderArt = require('../../../../assets/illustrations/char-rider-scooter.webp');
const routeArt = require('../../../../assets/illustrations/delivery-map-route.webp');
const hubArt = require('../../../../assets/illustrations/map-pin-storefront.webp');
const customerArt = require('../../../../assets/illustrations/person-shopping-list.webp');

const mapsUrl = (j: RiderJob) =>
  j.dropoff_latitude != null && j.dropoff_longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${j.dropoff_latitude},${j.dropoff_longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.delivery_address || '')}`;

const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;

/** A white card in the app's style, with an illustration tile on the left. */
function InfoCard({ art, tint, label, title, lines, children }: { art: number; tint: string; label: string; title: string; lines?: (string | null | undefined)[]; children?: React.ReactNode }) {
  return (
    <View className="gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm">
      <View className="flex-row items-center gap-4">
        <View className={`h-[76px] w-[76px] items-center justify-center rounded-2xl ${tint}`}>
          <Image source={art} resizeMode="contain" className="h-[60px] w-[60px]" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-xs font-bold uppercase tracking-wide text-faint">{label}</Text>
          <Text className="text-lg font-extrabold tracking-tight text-ink">{title}</Text>
          {(lines ?? []).filter(Boolean).map((l) => (
            <Text key={l} className="text-sm leading-5 text-muted">
              {l}
            </Text>
          ))}
        </View>
      </View>
      {children}
    </View>
  );
}

function Pickup({ job, photos, onPhotos }: { job: RiderJob; photos: ProofPhoto[]; onPhotos: (next: ProofPhoto[]) => void }) {
  return (
    <>
      <View className="items-center gap-1 rounded-3xl bg-brand-orange/20 px-5 py-5">
        <Text className="text-sm font-semibold text-ink/70">Show this code to the shopkeeper</Text>
        <Text className="text-[56px] font-extrabold leading-[64px] tracking-[10px] text-ink">{job.pickup_code}</Text>
        <Text className="text-center text-xs leading-4 text-ink/70">They enter it to hand you the order. Don&apos;t share it with anyone else.</Text>
      </View>
      <InfoCard
        art={hubArt}
        tint="bg-gold/40"
        label="Collect from"
        title={job.hub_name || 'The hub'}
        lines={[job.market_name, `${items(job.item_count)} to collect`, job.delivery_address ? `Then deliver to ${job.delivery_address}` : null]}
      />
      <View className="gap-2">
        <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">Photo of the order (required)</Text>
        <GoodsPhotos photos={photos} onChange={onPhotos} max={3} hint="Take a photo of the order as you collect it. It shows what you picked up, and when and where." />
      </View>
      <View className="items-center rounded-3xl border border-line bg-surface p-4">
        <Text className="text-center text-sm text-muted">Waiting for the hub to hand it over. This page moves on by itself.</Text>
      </View>
    </>
  );
}

function Deliver({
  job,
  photos,
  onPhotos,
  pickupPhotos,
  onPickupPhotos,
  onDeliver,
}: {
  job: RiderJob;
  photos: ProofPhoto[];
  onPhotos: (next: ProofPhoto[]) => void;
  pickupPhotos: ProofPhoto[];
  onPickupPhotos: (next: ProofPhoto[]) => void;
  /** Sends the code to the server. Throws the server's message (e.g. a wrong code). */
  onDeliver: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  // The photo should be taken at the customer's door, if the order has a pinned location.
  const dropoff = job.dropoff_latitude != null && job.dropoff_longitude != null ? { name: 'the delivery address', latitude: job.dropoff_latitude, longitude: job.dropoff_longitude } : undefined;
  const needsPickupPhoto = pickupPhotos.length === 0;

  const confirm = async () => {
    if (code.length < 4 || photos.length === 0 || needsPickupPhoto) return setTried(true);
    setBusy(true);
    setProblem('');
    try {
      await onDeliver(code);
    } catch (e) {
      setProblem((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <InfoCard art={customerArt} tint="bg-brand-orange/15" label="Deliver to" title={job.customer_name || 'Customer'} lines={[job.delivery_address || 'No address on this order', job.delivery_landmark ? `Note: ${job.delivery_landmark}` : null]}>
        <View className="flex-row gap-2">
          {job.customer_phone ? <Button label="Call" variant="outline" className="flex-1" onPress={() => void Linking.openURL(`tel:${job.customer_phone}`)} /> : null}
          <Button label="Directions" variant="outline" className="flex-1" onPress={() => void Linking.openURL(mapsUrl(job))} />
        </View>
      </InfoCard>
      {needsPickupPhoto ? (
        <View className="gap-2">
          <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">Photo of the order from pickup (required)</Text>
          <GoodsPhotos photos={pickupPhotos} onChange={onPickupPhotos} max={3} error={tried ? 'Add a photo of the order you collected.' : undefined} hint="Take a photo of the order you collected from the hub." />
        </View>
      ) : null}
      <View className="gap-2">
        <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">Photo at the door (required)</Text>
        <GoodsPhotos photos={photos} onChange={onPhotos} place={dropoff} max={3} error={tried && photos.length === 0 ? 'Add a photo at the door to confirm.' : undefined} hint="Take a photo of the order at the customer's door as you hand it over. It shows it was delivered, and when and where." />
      </View>
      <View className="items-stretch gap-3 rounded-3xl border-2 border-brand-orange/60 bg-surface p-5 shadow-sm">
        <View className="gap-0.5">
          <Text className="text-center text-lg font-extrabold tracking-tight text-ink">Customer&apos;s code</Text>
          <Text className="text-center text-sm leading-5 text-muted">Ask for the 4-digit code on their phone before you hand anything over.</Text>
        </View>
        <CodeInput value={code} onChange={(c) => { setCode(c); setProblem(''); }} />
        {tried && code.length < 4 ? <Text className="text-center text-sm font-semibold text-red-700">Enter the customer&apos;s 4-digit code.</Text> : null}
        {problem ? <Text className="text-center text-sm font-semibold text-red-700">{problem}</Text> : null}
        <Button label="Confirm drop-off" busy={busy} onPress={confirm} />
      </View>
    </>
  );
}

function PoolCard({ job, index, busy, onClaim }: { job: RiderJob; index: number; busy?: boolean; onClaim: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(450)} className="gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm">
      <View className="flex-row items-center gap-4">
        <View className="h-[84px] w-[84px] items-center justify-center rounded-2xl bg-gold/40">
          <Image source={hubArt} resizeMode="contain" className="h-[68px] w-[68px]" />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-xs text-faint">Ready {ago(job.ready_at)}</Text>
          <Text className="text-lg font-extrabold tracking-tight text-ink" numberOfLines={1}>
            {job.hub_name || 'Market hub'}
          </Text>
          <Text className="text-sm text-muted" numberOfLines={1}>
            {[job.market_name, items(job.item_count), `#${shortId(job.id)}`].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      <Button label="Claim this job" busy={busy} onPress={onClaim} />
    </Animated.View>
  );
}

export default function Jobs() {
  const { pool, mine, earnings, loaded, error } = useRider();
  const [pickupPhotos, setPickupPhotos] = useState<ProofPhoto[]>([]);
  const [deliveryPhotos, setDeliveryPhotos] = useState<ProofPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  // What the rider is doing is decided by where the order is, which the hub changes: claimed and waiting at the hub (ready for
  // pickup), out for delivery once the hub has handed it over, then handed over to the customer.
  const job: RiderJob | null = mine[0] ?? null;
  // Once the rider has delivered, the job keeps a delivery time until the customer confirms, then it leaves the list.
  const handedOver = !!job && !!job.delivered_at;
  const delivering = !!job && job.status === 'out_for_delivery';

  // A new job starts with no photos.
  const jobId = job?.id ?? null;
  const [photosFor, setPhotosFor] = useState<string | null>(jobId);
  if (photosFor !== jobId) {
    setPhotosFor(jobId);
    setPickupPhotos([]);
    setDeliveryPhotos([]);
  }

  // Runs a rider action on the server; any refusal (one job at a time, someone else claimed it...) is shown at the top.
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setProblem('');
    try {
      await fn();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  let title = '';
  let body = '';
  if (!job) {
    title = pool.length > 0 ? `${pool.length} job${pool.length === 1 ? '' : 's'} waiting` : 'No jobs right now';
    body = pool.length > 0 ? "Claim one to get started. It's yours until you deliver it." : 'New orders show up here the moment a hub has one ready.';
  } else if (handedOver) {
    title = 'Handed over';
    body = 'Waiting for the customer to confirm. Your fee lands once they do.';
  } else if (delivering) {
    title = `Deliver to ${job.customer_name || 'the customer'}`;
    body = "Collected from the hub. Take it to the door and get the customer's code.";
  } else {
    title = `Go to ${job.hub_name || 'the hub'}`;
    body = "Show the shopkeeper your code and they'll hand you the order.";
  }
  const [top, accent] = splitAccent(title);
  const empty = !job && pool.length === 0 && loaded && !error;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {empty ? (
          <View className="items-center gap-2">
            <Animated.View entering={FadeInDown.duration(500)}>
              <Float>
                <Image source={riderArt} resizeMode="contain" style={{ width: 190, height: 140 }} />
              </Float>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center gap-2">
              <Text className="text-center text-[30px] font-extrabold leading-[36px] tracking-tight text-ink">
                {top}
                {'\n'}
                <Text className="text-[30px] font-extrabold leading-[36px] tracking-tight text-brand-orange-dark">{accent}</Text>
              </Text>
              <Text className="max-w-[300px] text-center text-base leading-6 text-muted">{body}</Text>
            </Animated.View>
          </View>
        ) : (
          <>
            {job ? (
              <View className="flex-row items-center justify-between">
                <View className="rounded-full border border-brand-orange/30 bg-brand-orange/15 px-3 py-1">
                  <Text className="text-xs font-bold text-brand-orange-dark">Order #{shortId(job.id)}</Text>
                </View>
                {!delivering ? (
                  <Pressable
                    hitSlop={8}
                    disabled={busy}
                    onPress={() =>
                      Alert.alert('Give this job back?', 'It goes back to the pool for other riders.', [
                        { text: 'Keep it', style: 'cancel' },
                        { text: 'Give it back', style: 'destructive', onPress: () => void act(() => rider.release(job.id)) },
                      ])
                    }>
                    <Text className="text-sm font-bold text-red-700">Give it back</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <PageHeader top={top} accent={accent} subtitle={body} art={delivering ? routeArt : riderArt} />
          </>
        )}

        {!loaded ? <Text className="text-center text-sm text-muted">Loading your jobs…</Text> : null}
        {error ? (
          <View className="items-center gap-2 rounded-3xl border border-line bg-surface p-4">
            <Text className="text-center text-sm font-semibold text-red-700">{error}</Text>
            <Button label="Try again" variant="outline" onPress={() => void rider.refresh()} />
          </View>
        ) : null}
        {problem ? (
          <View className="rounded-2xl bg-red-50 px-4 py-3">
            <Text className="text-sm font-semibold text-red-700">{problem}</Text>
          </View>
        ) : null}

        {!job && earnings ? (
          <StatTiles
            delay={80}
            items={[
              { value: pool.length, label: 'Available', art: hubArt, tint: 'bg-gold/40', hot: pool.length > 0 },
              { value: naira(earnings.earnings_today), label: 'Today', art: require('../../../../assets/illustrations/wallet.webp'), tint: 'bg-brand-orange/15' },
              { value: earnings.completed_count, label: 'Deliveries', art: riderArt, tint: 'bg-brand-green/15' },
            ]}
          />
        ) : null}

        {job && !delivering ? (
          <Pickup job={job} photos={pickupPhotos} onPhotos={setPickupPhotos} />
        ) : null}
        {job && delivering && !handedOver ? (
          <Deliver
            job={job}
            photos={deliveryPhotos}
            onPhotos={setDeliveryPhotos}
            pickupPhotos={pickupPhotos}
            onPickupPhotos={setPickupPhotos}
            onDeliver={(code) => rider.deliver(job.id, code)}
          />
        ) : null}
        {job && handedOver ? (
          <>
            <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-5 shadow-sm">
              <View className="mb-1 h-12 w-12 items-center justify-center rounded-full bg-brand-green/20">
                <Text className="text-2xl font-extrabold text-brand-army">✓</Text>
              </View>
              <Text className="text-lg font-extrabold tracking-tight text-brand-army">Drop-off confirmed</Text>
              <Text className="text-center text-sm leading-5 text-muted">You can take a new job as soon as the customer confirms.</Text>
            </View>
          </>
        ) : null}
        {!job && pool.length > 0 ? (
          <View className="gap-3">
            <View className="gap-0.5">
              <Text className="text-lg font-extrabold tracking-tight text-ink">Available jobs</Text>
              <Text className="text-sm text-muted">First to claim gets it.</Text>
            </View>
            {pool.map((j, i) => (
              <PoolCard key={j.id} job={j} index={i} busy={busy} onClaim={() => void act(() => rider.claim(j.id))} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
