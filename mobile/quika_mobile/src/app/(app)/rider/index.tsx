import { useCallback, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, ErrorBanner, Title } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { api, ApiError, type RiderJob } from '@/lib/api';
import { ago, errMsg, shortId } from '@/lib/format';
import { usePolling } from '@/lib/usePolling';

// A rider does one job at a time (the backend enforces it), so this screen is
// either "the one job you're on" or "the pool you can take from". The job moves
// through: ready_for_pickup (show the shopkeeper your code) -> out_for_delivery
// (enter the customer's code at the door) -> handed over (customer confirms).

const mapsUrl = (j: RiderJob) =>
  j.dropoff_latitude != null && j.dropoff_longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${j.dropoff_latitude},${j.dropoff_longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.delivery_address || '')}`;

const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;

function Pickup({ job, busy, onRelease }: { job: RiderJob; busy: boolean; onRelease: () => void }) {
  return (
    <>
      <Card highlight style={{ alignItems: 'center' }}>
        <Body style={{ fontWeight: '600' }}>Show this code to the shopkeeper</Body>
        <Text style={styles.bigCode}>{job.pickup_code}</Text>
        <Body style={{ textAlign: 'center', fontSize: 14 }}>
          They enter it to hand you the order. Don&apos;t share it with anyone else.
        </Body>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>{job.hub_name || 'The hub'}</Text>
        {job.market_name ? <Body>{job.market_name}</Body> : null}
        <Body>{items(job.item_count)} to collect</Body>
        {job.delivery_address ? <Body>Then deliver to {job.delivery_address}</Body> : null}
      </Card>
      <Button
        label="Can't do this one: give it back"
        variant="ghost"
        disabled={busy}
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

function Deliver({ job, busy, onDeliver }: { job: RiderJob; busy: boolean; onDeliver: (code: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <>
      <Card>
        <Body style={{ fontSize: 13 }}>Deliver to</Body>
        <Text style={styles.cardTitle}>{job.customer_name || 'Customer'}</Text>
        <Body>{job.delivery_address || 'No address on this order'}</Body>
        <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
          {job.customer_phone ? (
            <Button
              label="Call"
              variant="ghost"
              style={styles.half}
              onPress={() => void Linking.openURL(`tel:${job.customer_phone}`)}
            />
          ) : null}
          <Button label="Directions" variant="ghost" style={styles.half} onPress={() => void Linking.openURL(mapsUrl(job))} />
        </View>
      </Card>
      <Card highlight>
        <Text style={styles.cardTitle}>Customer&apos;s code</Text>
        <Body style={{ fontSize: 14 }}>Ask for the 4-digit code on their phone before you hand anything over.</Body>
        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="0000"
          placeholderTextColor={Colors.faint}
        />
        <Button label="Confirm drop-off" loading={busy} disabled={code.length < 4} onPress={() => onDeliver(code)} />
      </Card>
    </>
  );
}

function PoolCard({ job, busy, onClaim }: { job: RiderJob; busy: boolean; onClaim: () => void }) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{job.hub_name || 'Market hub'}</Text>
          {job.market_name ? <Body>{job.market_name}</Body> : null}
        </View>
        <Body style={{ fontSize: 12, color: Colors.faint }}>Ready {ago(job.ready_at)}</Body>
      </View>
      <Body>
        {items(job.item_count)} · #{shortId(job.id)}
      </Body>
      <Button label="Claim this job" loading={busy} onPress={onClaim} />
    </Card>
  );
}

export default function Jobs() {
  const [mine, setMine] = useState<RiderJob[] | null>(null);
  const [pool, setPool] = useState<RiderJob[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await api.riderMine();
      setMine(m);
      // The pool only matters when there's no job in hand.
      setPool(m.length === 0 ? await api.riderPool() : []);
      setFatal(null);
    } catch (e) {
      // 403: no rider record or suspended, so nothing else here will work.
      setFatal(e instanceof ApiError && e.status === 403 ? e.message : `Could not load jobs. ${errMsg(e)}`);
    }
  }, []);
  usePolling(load, 10_000);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const job = mine && mine.length > 0 ? mine[0] : null;
  const delivering = job?.status === 'out_for_delivery';
  const handedOver = delivering && !!job?.delivered_at;
  const loaded = mine !== null && pool !== null;

  let title = 'Loading jobs…';
  let body = '';
  if (loaded) {
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
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <View style={{ gap: Spacing.one }}>
          {job ? <Body style={styles.eyebrow}>Order #{shortId(job.id)}</Body> : <Body style={styles.eyebrow}>Ready to ride</Body>}
          <Title>{title}</Title>
          {body ? <Body>{body}</Body> : null}
        </View>

        <ErrorBanner message={fatal} />
        {!fatal && <ErrorBanner message={error} />}

        {!fatal && job && !delivering && (
          <Pickup job={job} busy={busy} onRelease={() => void act(() => api.riderRelease(job.id))} />
        )}
        {!fatal && job && delivering && !handedOver && (
          <Deliver job={job} busy={busy} onDeliver={(code) => void act(() => api.riderDeliver(job.id, code))} />
        )}
        {!fatal && handedOver && (
          <Card style={{ alignItems: 'center' }}>
            <Text style={{ color: Colors.primaryDark, fontWeight: '700' }}>Drop-off confirmed</Text>
            <Body style={{ textAlign: 'center' }}>You can take a new job as soon as the customer confirms.</Body>
          </Card>
        )}
        {!fatal && !job && pool && pool.map((j) => (
          <PoolCard key={j.id} job={j} busy={busy} onClaim={() => void act(() => api.riderClaim(j.id))} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  body: { padding: Spacing.four, gap: Spacing.three },
  eyebrow: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  cardTitle: { fontSize: 18, fontWeight: '800', color: Colors.ink },
  bigCode: { fontSize: 44, fontWeight: '800', letterSpacing: 10, color: Colors.primaryDark, marginVertical: Spacing.two },
  half: { flex: 1, backgroundColor: Colors.sunken },
  codeInput: {
    backgroundColor: Colors.sunken,
    borderRadius: Radius.md,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 12,
    textAlign: 'center',
    paddingVertical: 14,
    color: Colors.ink,
  },
});
