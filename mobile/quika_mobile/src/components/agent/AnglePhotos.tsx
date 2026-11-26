import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ProofViewer } from '@/components/GoodsPhotos';
import { Text } from '@/components/Text';
import { captureProof, stamp, type ProofPhoto } from '@/lib/proof';

export type Slot = { id: string; label: string; hint: string; group: 'Outside' | 'Inside' };

const CAMERA = ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z', 'M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'];

/**
 * A guided set of photos, one per angle. Each is taken live with the camera (no gallery), so an old or borrowed picture
 * can't stand in, and keeps the time and place it was taken. Tap an empty tile to take it; tap a photo to view it.
 */
export default function AnglePhotos({ slots, photos, onChange, error }: { slots: Slot[]; photos: Record<string, ProofPhoto | undefined>; onChange: (id: string, photo: ProofPhoto | null) => void; error?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ProofPhoto | null>(null);
  const taken = slots.filter((s) => photos[s.id]).length;

  const take = async (id: string) => {
    setBusy(id);
    const p = await captureProof();
    setBusy(null);
    if (p) onChange(id, p);
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="ml-1 text-xs font-bold uppercase tracking-wide text-faint">Take every photo now</Text>
        <Text className={'text-xs font-bold ' + (taken === slots.length ? 'text-brand-army' : 'text-muted')}>
          {taken} of {slots.length} added
        </Text>
      </View>

      {(['Outside', 'Inside'] as const).map((group) => {
        const inGroup = slots.filter((s) => s.group === group);
        if (inGroup.length === 0) return null;
        const done = inGroup.filter((s) => photos[s.id]).length;
        return (
          <View key={group} className="gap-3">
            <View className="flex-row items-center justify-between rounded-2xl bg-brand-orange/[0.12] px-4 py-2.5">
              <Text className="text-sm font-extrabold text-ink">{group}</Text>
              <Text className={'text-xs font-bold ' + (done === inGroup.length ? 'text-brand-army' : 'text-brand-orange-dark')}>
                {done} of {inGroup.length}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-3">
              {inGroup.map((s) => {
                const p = photos[s.id];
                const st = p ? stamp(p) : null;
                return (
                  <View key={s.id} style={{ width: '47.5%' }} className="gap-1.5">
                    {p ? (
                      <Pressable onPress={() => setViewing(p)} accessibilityLabel={`View ${s.label} photo`} className="overflow-hidden rounded-2xl border border-line bg-sunken">
                        <Image source={{ uri: p.uri }} style={{ width: '100%', aspectRatio: 4 / 3 }} />
                        <View className={'absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 ' + (st?.ok ? 'bg-brand-army' : 'bg-amber-600')}>
                          <Text className="text-[10px] font-bold text-white">{st?.ok ? '✓' : '!'}</Text>
                        </View>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => take(s.id)}
                        disabled={busy !== null}
                        accessibilityLabel={`Take ${s.label} photo`}
                        className={'items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed bg-surface-2 active:bg-brand-orange/10 ' + (error ? 'border-red-300' : 'border-brand-orange/50')}
                        style={{ aspectRatio: 4 / 3 }}>
                        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#D9702F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          {CAMERA.map((d) => (
                            <Path key={d} d={d} />
                          ))}
                        </Svg>
                        <Text className="text-xs font-bold text-brand-orange-dark">{busy === s.id ? 'Opening…' : 'Take photo'}</Text>
                      </Pressable>
                    )}
                    <View className="flex-row items-center justify-between gap-1 px-1">
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-ink">{s.label}</Text>
                        <Text className="text-[11px] leading-4 text-muted">{s.hint}</Text>
                      </View>
                      {p ? (
                        <Pressable onPress={() => take(s.id)} hitSlop={6} className="rounded-full border border-line-strong bg-surface px-2.5 py-1 active:bg-sunken">
                          <Text className="text-[11px] font-bold text-ink">Retake</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      {error ? <Text className="ml-1 text-xs font-semibold text-red-700">{error}</Text> : null}
      <ProofViewer photo={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}
