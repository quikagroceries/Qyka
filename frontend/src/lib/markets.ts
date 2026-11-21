/**
 * Markets come from the backend (GET /markets) - the one source of truth for
 * which markets exist, their slug, description, status, categories, image
 * and hours (see backend app/markets/directory.py). Everything matches on
 * `slug`, never on name, so renaming a market can't break a link.
 */

import { CAT_PANTRY, CAT_PRODUCE } from "@/lib/cdnImages";

export type VenueType = "local_market" | "supermarket";

export type FoodCategory =
  | "produce"
  | "provisions"
  | "protein"
  | "spices"
  | "fish"
  | "grains"
  | "household";

export type MarketStatus = "coming_soon" | "pilot" | "live";

export type Market = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: MarketStatus;
  categories: FoodCategory[];
  image_url: string | null;
  city: string;
  state: string;
  is_active: boolean;
  venue_type: VenueType;
  latitude: number | null;
  longitude: number | null;
  opening_time: string;
  closing_time: string;
  timezone: string;
};

export type MarketCardStatus = "open" | "closed" | "soon";

/** Pilot and live markets take orders; coming_soon ones don't (backend-enforced too). */
export function isOrderable(m: { status?: string | null; is_active?: boolean }) {
  return (m.status === "pilot" || m.status === "live") && m.is_active !== false;
}

/**
 * The one "is this market card open/closed/soon" calculation - shared by
 * every place a market shows up as a card (Home's teaser row, the full
 * Markets directory) so they can't drift onto different rules.
 */
export function getMarketCardStatus(market: Market, shopHoursOpen: boolean): MarketCardStatus {
  if (!isOrderable(market)) return "soon";
  return shopHoursOpen ? "open" : "closed";
}

export function findMarketBySlug<T extends { slug?: string | null }>(markets: T[] | null | undefined, slug: string | null | undefined): T | null {
  if (!slug || !markets) return null;
  return markets.find((m) => m.slug === slug) || null;
}

export function filterMarkets(markets: Market[], query: string): Market[] {
  const q = query.trim().toLowerCase();
  if (!q) return markets;
  return markets.filter((m) =>
    [m.name, m.city, m.state, m.description || ""].some((v) => v.toLowerCase().includes(q))
  );
}

export function isLocalMarket(m: { venue_type?: string }) {
  return (m.venue_type || "local_market") === "local_market";
}

/** Cover image for any market row - its own image, falling back by venue type. */
export function coverImageForMarket(m: { image_url?: string | null; venue_type?: string | null } | null | undefined): string {
  if (m?.image_url) return m.image_url;
  return (m?.venue_type || "") === "supermarket" ? CAT_PANTRY : CAT_PRODUCE;
}

// --- Server side (market pages, sitemap): fetched at request/build time ---

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const REVALIDATE_SECONDS = 300;

/** All public markets, or [] if the API can't be reached (never breaks a build). */
export async function fetchMarkets(): Promise<Market[]> {
  try {
    const res = await fetch(`${API_BASE}/markets`, { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

/** One market by slug: null when it doesn't exist; throws if the API is down
 * (so an outage shows an error page, not a cached "not found"). */
export async function fetchMarketBySlug(slug: string): Promise<Market | null> {
  const res = await fetch(`${API_BASE}/markets/slug/${encodeURIComponent(slug)}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Market API returned ${res.status}`);
  return res.json();
}
