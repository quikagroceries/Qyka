"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { naira } from "@/lib/orderMath";
import Card from "@/components/ui/Card";
import HeroBanner from "@/components/layout/HeroBanner";
import SectionHeader from "@/components/ui/SectionHeader";
import StatTile from "@/components/ui/StatTile";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import walletArt from "@/assets/illustrations/wallet.webp";
import { errMsg, shortId } from "./hubUtils";

export default function HubEarnings() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getHubEarnings()
      .then(setData)
      .catch((e) => setError("Could not load earnings. " + errMsg(e)));
  }, []);

  return (
    <div>
      <HeroBanner
        eyebrow="Earnings"
        title={data ? `${naira(data.earnings_today)} earned today.` : "Your earnings"}
        body="You earn a fixed fee for every order that goes through your hub. It counts once the customer confirms they received it."
        illustration={walletArt}
        illustrationAlt="Hub earnings"
      >
        {data && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Today" value={naira(data.earnings_today)} tone="green" />
            <StatTile label="Last 7 days" value={naira(data.earnings_week)} tone="green" />
            <StatTile label="All time" value={naira(data.earnings_total)} tone="green" />
            <StatTile label="Orders" value={data.completed_count} />
          </div>
        )}
      </HeroBanner>

      {error && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {!data && !error && <CardSkeleton />}

      {data && data.recent.length === 0 && (
        <EmptyState
          title="No earnings yet"
          subtitle="Your first fee shows up here once a customer confirms an order that went through your hub."
        />
      )}

      {data && data.recent.length > 0 && (
        <>
          <SectionHeader icon="check" title="Recent orders" className="mb-3" />
          <div className="flex flex-col gap-2">
            {data.recent.map((r: any) => (
              <Card key={r.order_id} className="flex items-center justify-between !p-4">
                <div>
                  <p className="font-display font-extrabold tracking-wide text-ink">#{shortId(r.order_id)}</p>
                  <p className="text-xs text-faint">
                    {new Date(r.delivered_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <p className="font-display text-lg font-extrabold tabular-nums text-brand-green">
                  +{naira(r.amount)}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
