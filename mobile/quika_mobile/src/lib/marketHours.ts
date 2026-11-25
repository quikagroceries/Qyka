import type { Market } from '@/lib/api';

// Is this market open right now? A courtesy only: the backend refuses
// closed-market orders regardless. Same window rules as the backend: opening
// inclusive, closing exclusive, overnight windows allowed.
export type OpenStatus = { open: boolean; opensAt: string };

const minutesOf = (hhmmss: string) => {
  const [h, m] = hhmmss.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function formatClock(hhmmss: string): string {
  const [h, m] = hhmmss.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

function localMinutesNow(timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** Null when the market has no hours (or the runtime can't do the timezone): leave the action on and let the backend decide. */
export function openStatus(m: Pick<Market, 'opening_time' | 'closing_time' | 'timezone'> | null | undefined): OpenStatus | null {
  if (!m?.opening_time || !m.closing_time) return null;
  let now: number;
  try {
    now = localMinutesNow(m.timezone || 'Africa/Lagos');
  } catch {
    return null;
  }
  const open = minutesOf(m.opening_time);
  const close = minutesOf(m.closing_time);
  const isOpen = open < close ? now >= open && now < close : now >= open || now < close;
  return { open: isOpen, opensAt: formatClock(m.opening_time) };
}
