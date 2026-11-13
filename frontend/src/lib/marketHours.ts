/** Shopping window shared by every market, in West Africa Time (Africa/Lagos, UTC+1, no DST). */

export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;

function lagosNow(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export const clock = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

export type MarketHoursStatus = { open: boolean; opensAtClock: string; closesAtClock: string };

/**
 * SSR-safe placeholder: server render time and client hydration time can
 * differ (a request near a boundary, clock skew), so the real, time-based
 * status must only be computed client-side after mount (see MarketingPage's
 * useEffect) - otherwise React logs a hydration mismatch. This default
 * assumes "open" since that's true for most of the day.
 */
export const SSR_SAFE_HOURS: MarketHoursStatus = { open: true, opensAtClock: clock(OPEN_HOUR), closesAtClock: clock(CLOSE_HOUR) };

/** Whether shopping is open right now, for every market. */
export function getMarketHoursStatus(): MarketHoursStatus {
  const now = lagosNow();
  const hour = now.getHours() + now.getMinutes() / 60;
  return {
    open: hour >= OPEN_HOUR && hour < CLOSE_HOUR,
    opensAtClock: clock(OPEN_HOUR),
    closesAtClock: clock(CLOSE_HOUR),
  };
}
