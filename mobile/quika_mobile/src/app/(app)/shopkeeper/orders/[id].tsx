import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { Text } from '@/components/Text';

import Animated, { FadeInUp } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import GoodsPhotos from '@/components/GoodsPhotos';
import OrderIdChip from '@/components/OrderIdChip';
import PageHeader from '@/components/PageHeader';
import { Button, Card, CodeInput, ItemArt, SafeAreaView, SectionHeader } from '@/components/ui';
import { ago, shortId, splitAccent } from '@/lib/format';
import { boughtItems, hub, useHub, useHubOrder } from '@/lib/hubStore';
import type { ProofPhoto } from '@/lib/proof';
import type { HubOrder } from '@/lib/types';

// One order, one job at a time: which panel shows is decided by where the
// order is in the hub's custody chain, so the shopkeeper only sees the next
// thing they can do.

const art = require('../../../../../assets/illustrations/order-handoff-vendor-customer.webp');

const itemLabel = (it: HubOrder['items'][number]) => `${it.quantity ? `${it.quantity} × ` : ''}${it.description}`;

export default function HubOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // The order comes from the server (the hub store asks again every few seconds). Once it has been handed over it leaves the
  // hub's list, so the last version seen is kept to show the "handed over" page.
  const { loaded, error: loadError } = useHub();
  const live = useHubOrder(id);
  const [kept, setKept] = useState<HubOrder | undefined>(live);
  if (live && live !== kept) setKept(live);
  const order = live ?? kept;

  // Check-in form: the items the shopkeeper switched OFF (not in the bag).
  const [unseen, setUnseen] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [triedCheckIn, setTriedCheckIn] = useState(false);
  // Handover
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [handedTo, setHandedTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const back = () => (router.canGoBack() ? router.back() : router.replace('/shopkeeper'));

  // Runs a hub action on the server; any refusal is shown on the page.
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

  if (!order) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-8" edges={['top']}>
        <Text className="text-center text-base text-muted">{loaded && loadError ? loadError : loaded ? "We couldn't find that order at your hub." : 'Loading the order…'}</Text>
        <Button label="Back" variant="outline" onPress={back} />
      </SafeAreaView>
    );
  }
  const status = order.status;

  const items = order.items;
  // Only items that were actually bought should be in the bag; skipped ones aren't expected.
  const expected = boughtItems(order);
  const notBought = items.length - expected.length;
  const missing = expected.filter((i) => unseen.has(i.id));
  const seenIds = expected.filter((i) => !unseen.has(i.id)).map((i) => i.id);

  const shell = (eyebrow: string, title: string, body: string, content: React.ReactNode) => {
    const [top, accent] = splitAccent(title);
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <OrderBackdrop />
        <ScrollView contentContainerClassName="gap-5 px-5 pb-10 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInUp.duration(450)} className="flex-row items-center justify-between">
            <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
              <Text className="text-2xl text-ink">‹</Text>
            </Pressable>
            <OrderIdChip id={order.id} />
            <View className="h-11 w-11" />
          </Animated.View>
          <View className="gap-2">
            <View className="self-start rounded-full border border-brand-orange/30 bg-brand-orange/15 px-3 py-1">
              <Text className="text-xs font-bold text-brand-orange-dark">{eyebrow}</Text>
            </View>
            <PageHeader top={top} accent={accent} subtitle={body} art={art} />
          </View>
          {content}
        </ScrollView>
      </SafeAreaView>
    );
  };

  // ── Dropped: check what arrived against the list ──────────────────────
  if (status === 'dropped_at_hub') {
    return shell(
      'Dropped at hub',
      `Check in #${shortId(order.id)}`,
      `${order.agent_name || 'The agent'} dropped this ${ago(order.dropped_at_hub_at)}. Switch on what you can see in the bag.`,
      <>
        <Card>
          <SectionHeader title="What's in the bag" />
          {expected.map((it) => {
            const on = !unseen.has(it.id);
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
                    setUnseen((cur) => {
                      const next = new Set(cur);
                      if (on) next.add(it.id);
                      else next.delete(it.id);
                      return next;
                    })
                  }
                />
              </View>
            );
          })}
          {notBought > 0 ? <Text className="mt-2 text-xs leading-4 text-muted">{notBought} item{notBought === 1 ? ' was' : 's were'} never bought, so {notBought === 1 ? "it isn't" : "they aren't"} expected in the bag.</Text> : null}
        </Card>

        {order.packing_photos && order.packing_photos.length > 0 ? (
          <Card>
            <SectionHeader title="The agent's photos" subtitle="What they photographed when they dropped it off." />
            <View className="flex-row flex-wrap gap-2">
              {order.packing_photos.map((u) => (
                <Image key={u} source={{ uri: u }} className="h-20 w-20 rounded-xl bg-sunken" />
              ))}
            </View>
          </Card>
        ) : null}

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
              className={'font-body min-h-[64px] rounded-2xl border bg-surface p-3 text-base text-ink ' + (triedCheckIn && !note.trim() ? 'border-red-300' : 'border-line')}
            />
            {triedCheckIn && !note.trim() ? (
              <Text className="text-xs font-semibold text-red-700">Add a note about what&apos;s missing to check in.</Text>
            ) : (
              <Text className="text-xs text-muted">You can still check it in. A note about what&apos;s missing is required, and it is kept on the order.</Text>
            )}
          </View>
        ) : null}

        <Card>
          <SectionHeader title="Photo of the goods" subtitle="Required. It protects you and the agent." />
          <GoodsPhotos
            photos={photos}
            onChange={setPhotos}
            error={triedCheckIn && photos.length === 0 ? 'Add a photo of the goods to check in.' : undefined}
            hint="Photograph what's in the bag as it arrived, before you check it in."
          />
        </Card>

        {problem ? <Text className="text-center text-sm font-semibold text-red-700">{problem}</Text> : null}
        <Button
          label={missing.length > 0 ? `Check in with ${missing.length} missing` : "Everything's here: check in"}
          busy={busy}
          onPress={() => {
            // Stays tappable so it can say what's missing, instead of looking broken.
            if (photos.length === 0 || (missing.length > 0 && !note.trim())) return setTriedCheckIn(true);
            void act(() => hub.checkIn(order.id, seenIds, note, photos.map((p) => p.uri)));
          }}
        />
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
        {problem ? <Text className="text-center text-sm font-semibold text-red-700">{problem}</Text> : null}
        <Button label="Ready for a rider" busy={busy} onPress={() => void act(() => hub.markReady(order.id))} />
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
            <CodeInput value={code} onChange={(c) => { setCode(c); setCodeError(''); }} />
            {codeError ? <Text className="text-center text-sm font-semibold text-red-700">{codeError}</Text> : null}
            <Button
              label="Hand over to rider"
              busy={busy}
              disabled={code.length < 4}
              onPress={async () => {
                const rider = order.rider_name || 'the rider';
                setBusy(true);
                setCodeError('');
                try {
                  await hub.handOver(order.id, code);
                  setHandedTo(rider);
                } catch (e) {
                  setCodeError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Text className="text-center text-xs text-muted">Only hand the bag over once the code matches.</Text>
          </Card>
        ) : (
          <Card className="items-center">
            <Text className="text-muted">Waiting for a rider to claim this order…</Text>
            <Text className="text-center text-xs text-faint">It&apos;s in the riders&apos; list now.</Text>
          </Card>
        )}
        <Card>
          <SectionHeader title="In the bag" />
          {expected.map((it) => (
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
