import { useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/Text';
import { Button } from '@/components/ui';
import { captureProof, stamp, type Place, type ProofPhoto } from '@/lib/proof';

const CAMERA = ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z', 'M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'];

/** Full-screen view of a proof photo, with when and where it was taken underneath. */
export function ProofViewer({ photo, onClose }: { photo: ProofPhoto | null; onClose: () => void }) {
  const s = photo ? stamp(photo) : null;
  return (
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-black/90 p-4">
        {photo ? <Image source={{ uri: photo.uri }} className="h-full w-full" resizeMode="contain" /> : null}
        {s ? (
          <View className="absolute bottom-12 left-5 right-5 rounded-2xl bg-white/95 px-4 py-3">
            <Text className={'text-sm font-bold ' + (s.ok ? 'text-brand-army' : 'text-amber-700')}>{s.text}</Text>
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

/**
 * Photos of the goods: a compulsory proof step. Camera only, so an old photo or a screenshot can't stand in.
 * Each photo keeps when and where it was taken, and is checked against where it should have been
 * (`place`). A photo taken elsewhere, or with no location, still counts but is flagged for review.
 * UI only: nothing is uploaded, and the time is the phone's.
 */
export default function GoodsPhotos({ photos, onChange, place, max = 4, hint, error }: { photos: ProofPhoto[]; onChange: (next: ProofPhoto[]) => void; place?: Place; max?: number; hint?: string; error?: string }) {
  const [viewing, setViewing] = useState<ProofPhoto | null>(null);
  const [busy, setBusy] = useState(false);

  const take = async () => {
    setBusy(true);
    const p = await captureProof(place);
    setBusy(false);
    if (p) onChange([...photos, p].slice(0, max));
  };

  const stamps = photos.map(stamp);
  const flagged = stamps.some((s) => !s.ok);

  return (
    <View className="gap-2">
      {photos.length === 0 ? (
        <View className={'gap-3 rounded-2xl border-2 border-dashed bg-surface p-4 ' + (error ? 'border-red-300' : 'border-brand-orange/50')}>
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/15">
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#D9702F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                {CAMERA.map((d) => (
                  <Path key={d} d={d} />
                ))}
              </Svg>
            </View>
            <Text className="flex-1 text-sm leading-5 text-muted">{hint ?? 'Take a clear photo of the goods. It is required, and it protects everyone.'}</Text>
          </View>
          <Button label={busy ? 'Opening camera…' : 'Take photo'} disabled={busy} onPress={take} />
          {error ? <Text className="text-center text-sm font-semibold text-red-700">{error}</Text> : <Text className="text-center text-xs text-faint">Taken live with the camera. The time and place are saved with it.</Text>}
        </View>
      ) : (
        <View className="gap-3 rounded-2xl bg-surface p-3">
          <View className="flex-row flex-wrap gap-3">
            {photos.map((p, i) => (
              <View key={p.uri + i}>
                <Pressable onPress={() => setViewing(p)} accessibilityLabel="View photo">
                  <Image source={{ uri: p.uri }} className="h-20 w-20 rounded-xl bg-sunken" />
                  <View className={'absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 ' + (stamps[i].ok ? 'bg-brand-army' : 'bg-amber-600')}>
                    <Text className="text-[10px] font-bold text-white">{stamps[i].ok ? '✓' : '!'}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => onChange(photos.filter((_, k) => k !== i))}
                  hitSlop={6}
                  accessibilityLabel="Remove photo"
                  className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-surface">
                  <Text className="text-xs font-extrabold text-red-700">✕</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View className="gap-1">
            {stamps.map((s, i) => (
              <Text key={i} className={'text-xs ' + (s.ok ? 'font-semibold text-brand-army' : 'font-semibold text-amber-700')}>
                {photos.length > 1 ? `${i + 1}. ` : ''}
                {s.text}
              </Text>
            ))}
          </View>
          {flagged ? <Text className="text-xs leading-4 text-muted">Flagged photos are kept for review. You can still continue.</Text> : null}

          {photos.length < max ? (
            <Pressable onPress={take} disabled={busy} className="self-start rounded-full border border-line-strong bg-surface px-3.5 py-1.5 active:bg-sunken">
              <Text className="text-xs font-bold text-ink">{busy ? 'Opening camera…' : '+ Take another'}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <ProofViewer photo={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}
