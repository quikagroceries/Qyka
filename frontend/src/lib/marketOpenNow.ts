/**
 * Is THIS market open right now, from the per-market hours the API returns
 * (opening_time / closing_time / timezone - see backend markets/hours.py).
 *
 * A UX courtesy only: the backend refuses closed-market orders regardless,
 * so never treat a disabled button as the protection. Separate from
 * marketHours.ts, which drives the marketing site's shared hours display.
 */

type MarketHours = { opening_time?: string | null; closing_time?: string | null; timezone?: string | null };

export type MarketOpenStatus = { open: boolean; opensAt: string };

function minutesOf(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** "08:00:00" -> "8:00 am", "20:30:00" -> "8:30 pm". */
export function formatClock(hhmmss: string): string {
  const [h, m] = hhmmss.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

function localMinutesNow(timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * Null when the market has no hours (an older API) - callers then leave the
 * action enabled and let the backend decide. Same window rules as the
 * backend: opening inclusive, closing exclusive, overnight windows allowed.
 */
export function getMarketOpenStatus(market: MarketHours | null | undefined): MarketOpenStatus | null {
  if (!market?.opening_time || !market.closing_time) return null;
  let now: number;
  try {
    now = localMinutesNow(market.timezone || "Africa/Lagos");
  } catch {
    return null;
  }
  const open = minutesOf(market.opening_time);
  const close = minutesOf(market.closing_time);
  const isOpen = open < close ? now >= open && now < close : now >= open || now < close;
  return { open: isOpen, opensAt: formatClock(market.opening_time) };
}
