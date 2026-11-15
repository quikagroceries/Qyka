import Link from "next/link";

import { DIRECTORY_MARKETS, getMarketCardStatus } from "@/lib/marketDirectory";
import type { MarketHoursStatus } from "@/lib/marketHours";
import { useT } from "@/lib/locale";
import { Stagger, StaggerItem } from "@/components/marketing/motion";
import { SectionRider, type RiderArt } from "@/components/marketing/SectionRider";
import SectionHead from "@/components/marketing/SectionHead";
import MarketCard from "@/components/marketing/MarketCard";

import riderBicycle from "@/assets/illustrations/rider-bicycle.webp";

const RIDER_ART: RiderArt = { src: riderBicycle, size: "w-20 sm:w-28 lg:w-32", bump: true };

export default function MarketsSection({
  caption,
  launchedCount,
  liveMarkets,
  hours,
}: {
  caption: string;
  launchedCount: number;
  liveMarkets: any[] | null;
  hours: MarketHoursStatus;
}) {
  const t = useT();
  return (
    <section id="markets" className="relative scroll-mt-24 border-y border-line bg-surface">
      <SectionRider caption={caption} art={RIDER_ART} />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead eyebrow={t.markets.eyebrow} title={t.markets.title} sub={t.markets.sub(launchedCount)}>
          <Link href="/markets" className="mt-4 inline-flex items-center rounded-full border border-line bg-white px-5 py-2 font-display text-sm font-bold text-ink shadow-sm transition hover:border-brand-orange hover:bg-[#FBE7D5]">
            {t.markets.all}
          </Link>
        </SectionHead>
        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.09}>
          {DIRECTORY_MARKETS.slice(0, 6).map((m) => {
            const status = getMarketCardStatus(m, liveMarkets, hours.open);
            return (
              <StaggerItem key={m.id} y={32}>
                <MarketCard
                  market={m}
                  status={status}
                  statusLabel={status === "open" ? t.markets.open : status === "closed" ? t.markets.closed : t.markets.soon}
                  venueLabel={m.venueType === "supermarket" ? t.markets.supermarket : t.markets.local}
                  timeLabel={
                    status === "open" ? t.markets.closesAt(hours.closesAtClock)
                    : status === "closed" ? t.markets.opensAt(hours.opensAtClock)
                    : undefined
                  }
                  actionLabel={status === "open" ? t.markets.startHere : status === "closed" ? t.markets.comeBack : t.markets.notify}
                />
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
