import * as Location from 'expo-location';

import { clockTime } from '@/lib/format';
import { pickPhoto } from '@/lib/pickPhoto';

/** A place a photo should be taken at. Coordinates are approximate sample data for the demo. */
export type Place = { name: string; latitude: number; longitude: number };

export const PLACES: Record<string, Place> = {
  'm-1': { name: 'Mile 12 Hub', latitude: 6.6076, longitude: 3.3993 },
  'm-2': { name: 'Oyingbo Hub', latitude: 6.4797, longitude: 3.3867 },
  'm-3': { name: 'Ketu Hub', latitude: 6.5919, longitude: 3.3893 },
};

/** Within this distance of the place counts as "there" (markets are big and GPS drifts indoors). */
const RADIUS_M = 300;

export type ProofCheck =
  | { state: 'at_place'; placeName: string; distanceM: number }
  | { state: 'away'; placeName: string; distanceM: number }
  | { state: 'no_location' }
  | { state: 'no_place' };

/**
 * A photo of the goods, kept with when and where it was taken. It can only come from the camera, so an old
 * photo or a screenshot can't stand in. UI only: the time here is the phone's, and nothing is uploaded or
 * verified by a server yet. The backend should stamp its own time on arrival and re-check the location.
 */
export type ProofPhoto = {
  uri: string;
  takenAt: string;
  location: { latitude: number; longitude: number; accuracy: number | null } | null;
  check: ProofCheck;
};

const rad = (d: number) => (d * Math.PI) / 180;

/** Distance in metres between two points (haversine). */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function verify(location: ProofPhoto['location'], place?: Place): ProofCheck {
  if (!place) return { state: 'no_place' };
  if (!location) return { state: 'no_location' };
  const distanceM = distanceMeters(location, place);
  return { state: distanceM <= RADIUS_M ? 'at_place' : 'away', placeName: place.name, distanceM };
}

/** Where the person is now, or null if they say no, there is no signal, or it takes too long. */
async function startPosition(): Promise<Promise<ProofPhoto['location']>> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return Promise.resolve(null);
    const fix = Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
    return fix.then((p) => (p ? { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy } : null)).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

/** Opens the camera and records the time and place. Returns null if they cancel. */
export async function captureProof(place?: Place): Promise<ProofPhoto | null> {
  // Ask for (and start reading) the location before the camera opens, so the fix is where they were standing.
  const position = await startPosition();
  const uri = await pickPhoto('camera', { devFallback: true });
  if (!uri) return null;
  const takenAt = new Date().toISOString();
  const location = await position;
  return { uri, takenAt, location, check: verify(location, place) };
}

const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

/** One line for a photo: when, and whether it was where it should be. `ok` is false when it is flagged for review. */
export function stamp(p: ProofPhoto): { text: string; ok: boolean } {
  const time = clockTime(p.takenAt);
  switch (p.check.state) {
    case 'at_place':
      return { text: `${time} · At ${p.check.placeName} ✓`, ok: true };
    case 'away':
      return { text: `${time} · ${km(p.check.distanceM)} from ${p.check.placeName}, flagged for review`, ok: false };
    case 'no_location':
      return { text: `${time} · Location unavailable, flagged for review`, ok: false };
    default:
      return { text: `${time} · Location recorded`, ok: true };
  }
}
