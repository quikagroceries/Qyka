"use client";

import { useEffect, useState } from "react";
import { useMarkets } from "@/lib/useMarkets";
import { getMarketHoursStatus, SSR_SAFE_HOURS } from "@/lib/marketHours";

/**
 * The backend's markets (status, metadata), plus the shared shopping window (marketHours.ts) -
 * whatever page shows a grid of market cards needs both to compute each
 * card's open/closed/soon status (see getMarketCardStatus). One hook so
 * Home and the Markets directory can't quietly diverge on how often they
 * refetch or poll.
 */
export function useMarketAvailability() {
  // The backend's market list (slug, status, metadata) - shared with every
  // other useMarkets() caller on the page, so it's fetched once.
  const liveMarkets = useMarkets();

  const [hours, setHours] = useState(SSR_SAFE_HOURS);
  useEffect(() => {
    setHours(getMarketHoursStatus());
    const id = setInterval(() => setHours(getMarketHoursStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  return { liveMarkets, hours };
}
