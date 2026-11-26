/** "just now" / "12 min ago" / "3 h ago" / a date. */
export function ago(iso?: string | null): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

/** Amounts arrive as decimal strings in naira ("1000.00"). */
export function naira(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `₦${(Number.isFinite(n) ? n : 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Clock time for today, otherwise the day: how the inbox dates a row. */
export const whenLabel = (iso: string) => (dayLabel(iso) === 'Today' ? clockTime(iso) : dayLabel(iso));

/** Splits a heading into the dark part and the peach part (the last word, or last two if the last is tiny: "is checked in"). */
export function splitAccent(title: string): [string, string] {
  const w = title.trim().split(/\s+/);
  if (w.length === 1) return ['', w[0]];
  const take = w.length > 2 && w[w.length - 1].length <= 3 ? 2 : 1;
  return [w.slice(0, -take).join(' '), w.slice(-take).join(' ')];
}
