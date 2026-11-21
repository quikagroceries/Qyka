"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Market } from "@/lib/markets";

/** Client hook: the public market list, fetched once per page load and shared. */
let cached: Promise<Market[]> | null = null;
export function useMarkets(): Market[] | null {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  useEffect(() => {
    let alive = true;
    cached = cached || api.getMarkets().catch((e: unknown) => {
      cached = null; // let the next mount retry
      throw e;
    });
    cached.then((m) => alive && setMarkets(m)).catch(() => alive && setMarkets([]));
    return () => {
      alive = false;
    };
  }, []);
  return markets;
}
