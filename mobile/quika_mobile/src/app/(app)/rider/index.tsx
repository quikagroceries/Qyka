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
import { hub, useCustomerOrderId, useHubJob, useHubJobs } from '@/lib/hubStore';
import { EARNINGS, RIDER_ACTIVE, RIDER_POOL } from '@/lib/mock';
import { orderStore, useOrder } from '@/lib/orderStore';
import { PLACES, type ProofPhoto } from '@/lib/proof';
import type { RiderJob } from '@/lib/types';

// A rider does one job at a time (the backend enforces it), so this screen is
// either "the one job you're on" or "the pool you can take from". The job moves
// through: ready_for_pickup (show the shopkeeper your code) -> out_for_delivery
// (enter the customer's code at the door) -> handed over (customer confirms).

const riderArt = require('../../../../assets/illustrations/char-rider-scooter.webp');
const routeArt = require('../../../../assets/illustrations/delivery-map-route.webp');
const hubArt = require('../../../../assets/illustrations/map-pin-storefront.webp');
const customerArt = require('../../../../assets/illustrations/person-shopping-list.webp');

const RIDER_NAME = 'Musa Ibrahim';

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

function Pickup({ job, photos, onPhotos, error }: { job: RiderJob; photos: ProofPhoto[]; onPhotos: (next: ProofPhoto[]) => void; error?: string }) {
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
        <GoodsPhotos
          photos={photos}
          onChange={onPhotos}
          place={PLACES['m-1']}
          max={3}
          error={error}
          hint="Take a photo of the order as you collect it. It shows what you picked up, and when and where."
        />
      </View>
    </>
  );
}

function Deliver({ job, photos, onPhotos, expectedCode, onDeliver }: { job: RiderJob; photos: ProofPhoto[]; onPhotos: (next: ProofPhoto[]) => void; expectedCode?: string | null; onDeliver: () => void }) {
  const [code, setCode] = useState('');
  const [tried, setTried] = useState(false);
  const [wrongCode, setWrongCode] = useState(false);
  // The photo should be taken at the customer's door, if the order has a pinned location.
  const dropoff = job.dropoff_latitude != null && job.dropoff_longitude != null ? { name: 'the delivery address', latitude: job.dropoff_latitude, longitude: job.dropoff_longitude } : undefined;
  return (
    <>
      <InfoCard art={customerArt} tint="bg-brand-orange/15" label="Deliver to" title={job.customer_name || 'Customer'} lines={[job.delivery_address || 'No address on this order']}>
        <View className="flex-row gap-2">
          {job.customer_phone ? <Button label="Call" variant="outline" className="flex-1" onPress={() => void Linking.openURL(`tel:${job.customer_phone}`)} /> : null}
          <Button label="Directions" variant="outline" className="flex-1" onPress={() => void Linking.openURL(mapsUrl(job))} />
        </View>
      </InfoCard>
      <View className="gap-2">
        <Text className="ml-2 text-xs font-bold uppercase tracking-wide text-faint">Photo at the door (required)</Text>
        <GoodsPhotos photos={photos} onChange={onPhotos} place={dropoff} max={3} error={tried && photos.length === 0 ? 'Add a photo at the door to confirm.' : undefined} hint="Take a photo of the order at the customer's door as you hand it over. It shows it was delivered, and when and where." />
      </View>
      <View className="items-stretch gap-3 rounded-3xl border-2 border-brand-orange/60 bg-surface p-5 shadow-sm">
        <View className="gap-0.5">
          <Text className="text-center text-lg font-extrabold tracking-tight text-ink">Customer&apos;s code</Text>
          <Text className="text-center text-sm leading-5 text-muted">Ask for the 4-digit code on their phone before you hand anything over.</Text>
        </View>
        <CodeInput value={code} onChange={(c) => { setCode(c); setWrongCode(false); }} />
        {tried && code.length < 4 ? <Text className="text-center text-sm font-semibold text-red-700">Enter the customer&apos;s 4-digit code.</Text> : null}
        {wrongCode ? <Text className="text-center text-sm font-semibold text-red-700">That code doesn&apos;t match the customer&apos;s. Ask them to check their phone.</Text> : null}
        {__DEV__ && expectedCode ? <Text className="text-center text-xs text-faint">Dev: the customer&apos;s code is {expectedCode}</Text> : null}
        <Button
          label="Confirm drop-off"
          onPress={() => {
            if (code.length < 4 || photos.length === 0) return setTried(true);
            // The code has to be the one the customer was given when the hub handed the order over.
            if (expectedCode && code !== expectedCode) return setWrongCode(true);
            onDeliver();
          }}
        />
      </View>
    </>
  );
}

function PoolCard({ job, index, onClaim }: { job: RiderJob; index: number; onClaim: () => void }) {
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
      <Button label="Claim this job" onPress={onClaim} />
    </Animated.View>
  );
}

// UI only: claiming, collecting and delivering just step through local state.
type Stage = 'pool' | 'pickup' | 'deliver' | 'handed';

export default function Jobs() {
  const [stage, setStage] = useState<Stage>('pool');
  const [pickupPhotos, setPickupPhotos] = useState<ProofPhoto[]>([]);
  const [deliveryPhotos, setDeliveryPhotos] = useState<ProofPhoto[]>([]);
  const [triedPickup, setTriedPickup] = useState(false);
  // The job this rider has claimed from the hub (a real order the shopkeeper marked ready), if any.
  const [activeId, setActiveId] = useState<string | null>(null);
  const hubJobs = useHubJobs();
  const claimed = useHubJob(activeId);
  // The customer's order behind the job: a hub order links to one; the sample job is the customer's out-for-delivery order.
  const linkedId = useCustomerOrderId(activeId) ?? (activeId ? null : 'a1b2c3d4-0004');
  const customerOrder = useOrder(linkedId);

  // Back to the pool: the next job starts with no photos. Giving a job back (before collecting it) also frees it at the hub.
  const toPool = (giveBack = false) => {
    if (giveBack && activeId) hub.releaseClaim(activeId);
    setActiveId(null);
    setPickupPhotos([]);
    setDeliveryPhotos([]);
    setTriedPickup(false);
    setStage('pool');
  };
  const claim = (j: RiderJob) => {
    if (hubJobs.some((h) => h.id === j.id)) {
      hub.claim(j.id, RIDER_NAME);
      setActiveId(j.id);
    }
    setStage('pickup');
  };
  const job: RiderJob | null = stage === 'pool' ? null : (claimed ?? RIDER_ACTIVE);
  // Orders the hub has ready come first; the rest are sample jobs.
  const pool = stage === 'pool' ? [...hubJobs, ...RIDER_POOL] : [];
  const delivering = stage === 'deliver' || stage === 'handed';
  const handedOver = stage === 'handed';

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
  const empty = !job && pool.length === 0;

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
                    onPress={() =>
                      Alert.alert('Give this job back?', 'It goes back to the pool for other riders.', [
                        { text: 'Keep it', style: 'cancel' },
                        { text: 'Give it back', style: 'destructive', onPress: () => toPool(true) },
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

        {!job ? (
          <StatTiles
            delay={80}
            items={[
              { value: pool.length, label: 'Available', art: hubArt, tint: 'bg-gold/40', hot: pool.length > 0 },
              { value: naira(EARNINGS.earnings_today), label: 'Today', art: require('../../../../assets/illustrations/wallet.webp'), tint: 'bg-brand-orange/15' },
              { value: EARNINGS.completed_count, label: 'Deliveries', art: riderArt, tint: 'bg-brand-green/15' },
            ]}
          />
        ) : null}

        {job && !delivering && <Pickup job={job} photos={pickupPhotos} onPhotos={setPickupPhotos} error={triedPickup && pickupPhotos.length === 0 ? 'Add a photo of the order to continue.' : undefined} />}
        {job && !delivering && <Button label="I've collected it from the hub" onPress={() => (pickupPhotos.length === 0 ? setTriedPickup(true) : setStage('deliver'))} />}
        {job && delivering && !handedOver && <Deliver
            job={job}
            photos={deliveryPhotos}
            onPhotos={setDeliveryPhotos}
            expectedCode={customerOrder?.handover_code}
            onDeliver={() => {
              if (linkedId) orderStore.riderDelivered(linkedId);
              setStage('handed');
            }}
          />}
        {handedOver && (
          <>
            <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-5 shadow-sm">
              <View className="mb-1 h-12 w-12 items-center justify-center rounded-full bg-brand-green/20">
                <Text className="text-2xl font-extrabold text-brand-army">✓</Text>
              </View>
              <Text className="text-lg font-extrabold tracking-tight text-brand-army">Drop-off confirmed</Text>
              <Text className="text-center text-sm leading-5 text-muted">You can take a new job as soon as the customer confirms.</Text>
            </View>
            <Button label="Back to jobs" variant="neutral" onPress={() => toPool()} />
          </>
        )}
        {!job && pool.length > 0 ? (
          <View className="gap-3">
            <View className="gap-0.5">
              <Text className="text-lg font-extrabold tracking-tight text-ink">Available jobs</Text>
              <Text className="text-sm text-muted">First to claim gets it.</Text>
            </View>
            {pool.map((j, i) => (
              <PoolCard key={j.id} job={j} index={i} onClaim={() => claim(j)} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
