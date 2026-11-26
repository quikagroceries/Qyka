import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import PinPicker from '@/components/PinPicker';
import { Field } from '@/components/ui';
import { api, type PlaceSuggestion } from '@/lib/api';

/** A delivery address: the text, the pin when it was picked from the search, and a note to help the rider. */
export type AddressValue = { address: string; landmark: string; latitude: number | null; longitude: number | null };

export const EMPTY_ADDRESS: AddressValue = { address: '', landmark: '', latitude: null, longitude: null };

const newSession = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Search-as-you-type for a delivery address. Picking a suggestion fixes the address and its map pin; if nothing fits (or search is
 * down) the person can still use what they typed, which has no pin. The landmark line is always asked for: it's what gets a rider the
 * last few metres.
 */
export default function AddressPicker({ value, onChange, saved }: { value: AddressValue; onChange: (v: AddressValue) => void; saved?: AddressValue | null }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');
  const [choosing, setChoosing] = useState(!value.address);
  const [pinning, setPinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef(newSession());
  const latest = useRef('');

  const onType = (text: string) => {
    setQuery(text);
    setNote('');
    latest.current = text;
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const found = await api.searchPlaces(text.trim(), session.current);
        if (latest.current !== text) return; // a newer search has started
        setResults(found);
        if (found.length === 0) setNote("No matches. Try the street or area, or use what you typed.");
      } catch (e) {
        if (latest.current !== text) return;
        setResults([]);
        setNote((e as Error).message);
      } finally {
        if (latest.current === text) setSearching(false);
      }
    }, 350);
  };

  const pick = async (s: PlaceSuggestion) => {
    setSearching(true);
    setNote('');
    try {
      const p = await api.getPlace(s.place_id, session.current);
      session.current = newSession(); // a finished search; the next one is billed on its own
      onChange({ address: p.address, landmark: value.landmark, latitude: p.latitude, longitude: p.longitude });
      setChoosing(false);
      setQuery('');
      setResults([]);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const useTyped = () => {
    onChange({ address: query.trim(), landmark: value.landmark, latitude: null, longitude: null });
    setChoosing(false);
    setQuery('');
    setResults([]);
  };

  return (
    <View className="gap-3">
      {choosing || !value.address ? (
        <View className="gap-2">
          {saved && saved.address && saved.address !== value.address ? (
            <Pressable
              onPress={() => {
                onChange({ ...saved });
                setChoosing(false);
              }}
              className="rounded-2xl bg-sunken px-4 py-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-faint">Saved address</Text>
              <Text className="font-semibold text-ink">{saved.address}</Text>
              {saved.landmark ? <Text className="text-xs text-muted">{saved.landmark}</Text> : null}
            </Pressable>
          ) : null}
          <Field value={query} onChangeText={onType} placeholder="Search your street, estate or area" autoCorrect={false} />
          {searching ? <ActivityIndicator color="#D9702F" /> : null}
          {results.length > 0 ? (
            <View className="overflow-hidden rounded-2xl border border-line bg-surface">
              {results.map((r, i) => (
                <Pressable key={r.place_id} onPress={() => void pick(r)} className={'px-4 py-3 active:bg-sunken ' + (i > 0 ? 'border-t border-line' : '')}>
                  <Text className="font-semibold text-ink">{r.title}</Text>
                  {r.subtitle ? <Text className="text-xs text-muted">{r.subtitle}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          {note ? <Text className="text-xs text-muted">{note}</Text> : null}
          {query.trim().length >= 8 ? (
            <Pressable onPress={useTyped} className="self-start rounded-full border border-line-strong bg-surface px-3.5 py-1.5 active:bg-sunken">
              <Text className="text-xs font-bold text-ink">Use what I typed</Text>
            </Pressable>
          ) : null}
          {value.address ? (
            <Pressable onPress={() => setChoosing(false)} hitSlop={6}>
              <Text className="text-xs font-bold text-brand-orange-dark">Keep {value.address}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View className="gap-1 rounded-2xl border border-line bg-surface px-4 py-3">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 font-semibold text-ink">{value.address}</Text>
            <Pressable onPress={() => setChoosing(true)} hitSlop={8}>
              <Text className="text-sm font-bold text-brand-orange-dark">Change</Text>
            </Pressable>
          </View>
          <Text className={'text-xs font-semibold ' + (value.latitude != null ? 'text-brand-army' : 'text-amber-700')}>
            {value.latitude != null ? '✓ Location found on the map' : 'Not found on the map. Drop a pin, or add a landmark so the rider can find you.'}
          </Text>
          <Pressable onPress={() => setPinning(true)} hitSlop={6} className="self-start">
            <Text className="text-xs font-bold text-brand-orange-dark">{value.latitude != null ? 'Adjust the pin on the map' : 'Drop a pin on the map'}</Text>
          </Pressable>
        </View>
      )}

      <PinPicker
        visible={pinning}
        start={value.latitude != null && value.longitude != null ? { latitude: value.latitude, longitude: value.longitude } : null}
        onClose={() => setPinning(false)}
        onConfirm={(pin) => {
          onChange({ ...value, latitude: pin.latitude, longitude: pin.longitude });
          setPinning(false);
        }}
      />

      <Field
        value={value.landmark}
        onChangeText={(t) => onChange({ ...value, landmark: t })}
        placeholder="Landmark or directions (gate colour, next to…)"
        maxLength={300}
        multiline
        className="min-h-[64px]"
        textAlignVertical="top"
      />
    </View>
  );
}
