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
