"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getMarketHoursStatus, SSR_SAFE_HOURS } from "@/lib/marketHours";

/**
 * Live is_active per market, plus the shared shopping window (marketHours.ts) -
 * whatever page shows a grid of market cards needs both to compute each
 * card's open/closed/soon status (see getMarketCardStatus). One hook so
 * Home and the Markets directory can't quietly diverge on how often they
 * refetch or poll.
 */
export function useMarketAvailability() {
  const [liveMarkets, setLiveMarkets] = useState<any[] | null>(null);
  useEffect(() => {
    api.getMarkets().then(setLiveMarkets).catch(() => setLiveMarkets([]));
  }, []);

  const [hours, setHours] = useState(SSR_SAFE_HOURS);
  useEffect(() => {
    setHours(getMarketHoursStatus());
    const id = setInterval(() => setHours(getMarketHoursStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  return { liveMarkets, hours };
}
