import { LANDING } from "@/content/landing";

// The fee numbers the pricing page prints, read from the server so they're
// the owner's current settings (Admin > Platform) - not a copy that can drift.
// Falls back to the landing defaults only if the server can't be reached.
export async function getLiveFees(): Promise<{ serviceFeePercent: number; deliveryFee: number; addItemFee: number }> {
  const fallback = LANDING.pricing.fees;
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const res = await fetch(`${base}/pricing`, { next: { revalidate: 60 } });
    if (!res.ok) return fallback;
    const p = await res.json();
    return {
      serviceFeePercent: Number(p.service_fee_percent),
      deliveryFee: Number(p.delivery_fee),
      addItemFee: Number(p.add_item_fee),
    };
  } catch {
    return fallback;
  }
}
