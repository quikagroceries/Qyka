"use client";

import { useState, useMemo, type FormEvent } from "react";
import Image from "next/image";
import { DIRECTORY_MARKETS, getMarketCardStatus } from "@/lib/marketDirectory";
import { useMarketAvailability } from "@/lib/useMarketAvailability";
import { useT } from "@/lib/locale";
import { cityRequestMailto } from "@/lib/contact";
import { Section } from "@/components/marketing/Section";
import FilterPills from "@/components/ui/FilterPills";
import MarketCard from "@/components/marketing/MarketCard";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { Stagger, StaggerItem } from "@/components/marketing/motion";
import WavyDivider from "@/components/ui/WavyDivider";
import { Float } from "@/components/marketing/anim";
import squiggle1 from "@/assets/illustrations/decorative-squiggle-1.webp";
import marketCart from "@/assets/illustrations/market-cart-vendor.webp";

const VENUE_OPTIONS = [
  { key: "all", label: "All Venues" },
  { key: "local_market", label: "Open-air Markets" },
  { key: "supermarket", label: "Supermarkets" },
];

const CITY_OPTIONS = [
  { key: "all", label: "All Cities" },
  { key: "Lagos", label: "Lagos" },
  { key: "Ibadan", label: "Ibadan" },
  { key: "Abuja", label: "Abuja" },
];

const STATUS_OPTIONS = [
  { key: "all", label: "All Status" },
  { key: "pilot", label: "Live" },
  { key: "coming_soon", label: "Coming soon" },
];

export function MarketsDirectory() {
  const t = useT();
  const { liveMarkets, hours } = useMarketAvailability();
  const [venueFilter, setVenueFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityRequest, setCityRequest] = useState("");
  const [citySent, setCitySent] = useState(false);

  function submitCityRequest(e: FormEvent) {
    e.preventDefault();
    if (!cityRequest.trim()) return;
    window.location.href = cityRequestMailto(cityRequest);
    setCitySent(true);
  }

  const filteredMarkets = useMemo(() => {
    return DIRECTORY_MARKETS.filter((market) => {
      const matchVenue = venueFilter === "all" || market.venueType === venueFilter;
      const matchCity = cityFilter === "all" || market.city.includes(cityFilter) || market.state.includes(cityFilter);
      const matchStatus = statusFilter === "all" || market.status === statusFilter;
      return matchVenue && matchCity && matchStatus;
    });
  }, [venueFilter, cityFilter, statusFilter]);

  return (
    <>
      <Section
        eyebrow="Markets"
        title="Find your market"
        lede="From bustling open-air stalls to trusted supermarkets, see where Qyka can shop for you."
        bg="canvas"
        className="relative overflow-hidden"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-brand-orange/15 blur-3xl" aria-hidden />
        <Image
          src={squiggle1}
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-[26%] top-2 hidden w-12 rotate-[8deg] opacity-[0.3] lg:block"
        />
        <Float amp={5} dur={5.5} className="pointer-events-none absolute right-2 top-0 hidden w-48 lg:block xl:w-56">
          <Image src={marketCart} alt="" aria-hidden className="w-full" />
        </Float>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-10">
          <div className="flex flex-wrap gap-4">
            <FilterPills
              variant="tabs"
              options={VENUE_OPTIONS}
              value={venueFilter}
              onChange={setVenueFilter}
              className="mb-0"
            />
            <FilterPills
              variant="tabs"
              options={CITY_OPTIONS}
              value={cityFilter}
              onChange={setCityFilter}
              className="mb-0"
            />
            <FilterPills
              variant="tabs"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              className="mb-0"
            />
          </div>
        </div>

        {filteredMarkets.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-xl text-muted font-medium mb-4">No markets found for this combination.</p>
            <MarketingButton onClick={() => {
              setVenueFilter("all");
              setCityFilter("all");
              setStatusFilter("all");
            }}>
              Reset filters
            </MarketingButton>
          </div>
        ) : (
          <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMarkets.map((market) => {
              const status = getMarketCardStatus(market, liveMarkets, hours.open);
              return (
                <StaggerItem key={market.id}>
                  <MarketCard
                    market={market}
                    status={status}
                    statusLabel={status === "open" ? t.markets.open : status === "closed" ? t.markets.closed : t.markets.soon}
                    venueLabel={market.venueType === "supermarket" ? t.markets.supermarket : t.markets.local}
                    timeLabel={
                      status === "open" ? t.markets.closesAt(hours.closesAtClock)
                      : status === "closed" ? t.markets.opensAt(hours.opensAtClock)
                      : undefined
                    }
                    actionLabel={status === "open" ? t.markets.startHere : status === "closed" ? t.markets.comeBack : t.markets.notify}
                    showCategories
                  />
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </Section>
      
      <WavyDivider />

      <Section
        title="Don't see your city?"
        lede="We're expanding fast. Drop your city below and we'll bump it up the list."
        bg="canvas-deep"
        narrow
        align="center"
      >
        {citySent ? (
          <p className="mt-8 text-center text-sm font-semibold text-brand-green">
            Opening your mail app — thanks for the vote for {cityRequest}.
          </p>
        ) : (
          <form className="max-w-md mx-auto flex gap-2 mt-8" onSubmit={submitCityRequest}>
            <input
              type="text"
              value={cityRequest}
              onChange={(e) => setCityRequest(e.target.value)}
              placeholder="E.g. Port Harcourt, Kano..."
              className="flex-1 h-[48px] rounded-full px-5 border border-line bg-surface text-ink focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
              required
            />
            <MarketingButton type="submit">Vote</MarketingButton>
          </form>
        )}
      </Section>
    </>
  );
}
