import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { Text } from '@/components/Text';

import { Button, Card, CodeInput, ErrorBanner, Hero, ItemArt, SafeAreaView, SectionHeader } from '@/components/ui';
import { api, type HubOrder } from '@/lib/api';
import { ago, errMsg, shortId } from '@/lib/format';
import { takeAndUploadPhoto } from '@/lib/upload';
import { usePolling } from '@/lib/usePolling';

// One order, one job at a time: which panel shows is decided by where the
// order is in the hub's custody chain, so the shopkeeper only sees the next
// thing they can do.

const art = require('../../../../../assets/illustrations/order-handoff-vendor-customer.webp');

const itemLabel = (it: HubOrder['items'][number]) => `${it.quantity ? `${it.quantity} × ` : ''}${it.description}`;

export default function HubOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<HubOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Check-in form
  const [seen, setSeen] = useState<Set<string> | null>(null); // null until the first load seeds "everything arrived"
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // Handover
  const [code, setCode] = useState('');
  const [handedTo, setHandedTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const o = await api.hubOrder(id);
      setOrder(o);
      setSeen((cur) => cur ?? new Set(o.items.map((i) => i.id)));
      setLoadError(null);
    } catch (e) {
      setLoadError(errMsg(e));
    }
  }, [id]);
  usePolling(load, 10_000);

  const back = () => router.replace('/shopkeeper');

  async function run(fn: () => Promise<HubOrder>, onDone?: () => void) {
    setError(null);
    setBusy(true);
    try {
      setOrder(await fn());
      onDone?.();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto() {
    setError(null);
    setUploading(true);
    try {
      const url = await takeAndUploadPhoto();
      if (url) setPhotos((cur) => [...cur, url]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUploading(false);
    }
  }

  const Back = (
    <Pressable onPress={back} className="self-start py-1">
      <Text className="text-sm font-semibold text-muted">← Back to hub</Text>
    </Pressable>
  );

  if (!order || !seen) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View className="gap-3 p-4">
          {Back}
          {loadError ? <ErrorBanner message={loadError} /> : <Text className="text-muted">Loading…</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const items = order.items;
  const missing = items.filter((i) => !seen.has(i.id));
  const status = order.status;

  const shell = (eyebrow: string, title: string, body: string, content: React.ReactNode) => (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        {Back}
        <Hero eyebrow={eyebrow} title={title} body={body} image={art} />
        {content}
      </ScrollView>
    </SafeAreaView>
  );

  // ── Dropped: check what arrived against the list ──────────────────────
  if (status === 'dropped_at_hub') {
    const needsNote = missing.length > 0 && !note.trim();
    return shell(
      'Dropped at hub',
      `Check in #${shortId(order.id)}`,
      `${order.agent_name || 'The agent'} dropped this ${ago(order.dropped_at_hub_at)}. Switch on what you can see in the bag.`,
      <>
        <Card>
          <SectionHeader title="What's in the bag" />
          {items.map((it) => {
            const on = seen.has(it.id);
            return (
              <View key={it.id} className="flex-row items-center gap-3 border-t border-line py-3">
                <ItemArt name={it.description} />
                <View className="flex-1">
                  <Text className={'font-semibold ' + (on ? 'text-ink' : 'text-red-600')}>{itemLabel(it)}</Text>
                  {it.requested_note ? <Text className="text-sm text-muted">{it.requested_note}</Text> : null}
                </View>
                <Switch
                  value={on}
                  trackColor={{ true: '#EE9A5A' }}
                  onValueChange={() =>
                    setSeen((cur) => {
                      const next = new Set(cur);
                      if (on) next.delete(it.id);
                      else next.add(it.id);
                      return next;
                    })
                  }
                />
              </View>
            );
          })}
        </Card>

        {missing.length > 0 ? (
          <View className="gap-2 rounded-3xl border border-brand-orange/30 bg-brand-orange/10 p-5">
            <Text className="font-semibold text-ink">
              {missing.length} item{missing.length === 1 ? '' : 's'} not in the bag
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
              placeholder="What's missing, and anything the agent told you"
              placeholderTextColor="#9B9B9B"
              className="font-body min-h-[64px] rounded-2xl border border-line bg-surface p-3 text-base text-ink"
            />
            <Text className="text-xs text-muted">You can still check it in. This note is kept on the order.</Text>
          </View>
        ) : null}

        <Card>
          <SectionHeader title="Photo of the goods" subtitle="Optional, but it protects you." />
          <View className="flex-row flex-wrap gap-2">
            {photos.map((src, i) => (
              <Image key={src + i} source={{ uri: src }} className="h-16 w-16 rounded-lg" />
            ))}
            <Pressable
              onPress={() => void addPhoto()}
              disabled={uploading}
              className="h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-line-strong">
              <Text className="text-xs font-semibold text-faint">{uploading ? '…' : '+ Photo'}</Text>
            </Pressable>
          </View>
        </Card>

        <ErrorBanner message={error} />
        <Button
          busy={busy}
          disabled={needsNote || uploading}
          label={missing.length > 0 ? `Check in with ${missing.length} missing` : "Everything's here: check in"}
          onPress={() =>
            void run(() =>
              api.hubReceive(order.id, {
                received_item_ids: missing.length > 0 ? [...seen] : undefined,
                note: note.trim() || undefined,
                photos,
              }),
            )
          }
        />
        {needsNote ? <Text className="text-center text-sm text-muted">Add a note about what&apos;s missing first.</Text> : null}
      </>,
    );
  }

  // ── Received: bag it and mark ready ───────────────────────────────────
  if (status === 'received_by_hub') {
    const flagged = new Set(order.hub_missing_item_ids);
    return shell(
      'Checked in',
      `#${shortId(order.id)} is checked in`,
      "Bag it up so it's ready the moment a rider arrives.",
      <>
        <Card>
          <SectionHeader title="Checked in" />
          {items.map((it) => (
            <View key={it.id} className="flex-row items-center justify-between gap-3 border-t border-line py-3">
              <ItemArt name={it.description} />
              <Text className={'flex-1 font-semibold ' + (flagged.has(it.id) ? 'text-red-600' : 'text-ink')}>{itemLabel(it)}</Text>
              {flagged.has(it.id) ? <Text className="text-xs font-bold text-red-600">Missing</Text> : null}
            </View>
          ))}
          {order.hub_receipt_note ? (
            <Text className="mt-2 rounded-2xl bg-sunken p-3 text-sm text-muted">{order.hub_receipt_note}</Text>
          ) : null}
        </Card>
        <ErrorBanner message={error} />
        <Button busy={busy} label="Ready for a rider" onPress={() => void run(() => api.hubReady(order.id))} />
      </>,
    );
  }

  // ── Ready: wait for a rider, then release with their code ─────────────
  if (status === 'ready_for_pickup') {
    return shell(
      order.rider_waiting ? 'Rider here' : 'Ready',
      order.rider_waiting ? `${order.rider_name || 'A rider'} is here` : `#${shortId(order.id)} is ready`,
      order.rider_waiting
        ? 'Ask them for the 4-digit code on their phone, and enter it to hand the order over.'
        : 'No rider has claimed it yet. This page updates by itself when one does.',
      <>
        {order.rider_waiting ? (
          <Card accent className="items-stretch">
            <Text className="text-center font-semibold text-ink">Rider&apos;s code</Text>
            <CodeInput value={code} onChange={setCode} />
            <ErrorBanner message={error} />
            <Button
              busy={busy}
              disabled={code.length < 4}
              label="Hand over to rider"
              onPress={() => void run(() => api.hubHandover(order.id, code), () => setHandedTo(order.rider_name || 'the rider'))}
            />
            <Text className="text-center text-xs text-muted">Only hand the bag over once the code matches.</Text>
          </Card>
        ) : (
          <Card className="items-center">
            <Text className="text-muted">Waiting for a rider to claim this order…</Text>
          </Card>
        )}
        <Card>
          <SectionHeader title="In the bag" />
          {items.map((it) => (
            <View key={it.id} className="flex-row items-center gap-3 border-t border-line py-3">
              <ItemArt name={it.description} />
              <Text className="flex-1 font-semibold text-ink">{itemLabel(it)}</Text>
            </View>
          ))}
        </Card>
      </>,
    );
  }

  // ── Gone: handed over (this session, or reopened later) ───────────────
  return shell(
    'Handed over',
    handedTo ? `Handed to ${handedTo}` : `#${shortId(order.id)} has left the hub`,
    "It's out for delivery. Your fee is added to your earnings once the customer confirms they received it.",
    <Button label="Back to hub" onPress={back} />,
  );
}
