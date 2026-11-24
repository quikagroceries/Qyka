// Small helpers shared by the shopkeeper screens.

/** "just now" / "12 min ago" / "3 h ago" / a date - how long goods have been waiting. */
export function ago(iso?: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The API's errors arrive as `422: {"detail":"..."}` - show just the detail. */
export function errMsg(e: any): string {
  const raw = String(e?.message || e || "");
  const m = raw.match(/^\d+:\s*(\{[\s\S]*\})$/);
  if (m) {
    try {
      const d = JSON.parse(m[1]).detail;
      if (typeof d === "string") return d;
    } catch {
      /* fall through */
    }
  }
  return raw || "Something went wrong";
}

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
