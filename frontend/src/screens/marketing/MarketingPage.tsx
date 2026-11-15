"use client";

import { MotionConfig } from "framer-motion";

import { DIRECTORY_MARKETS } from "@/lib/marketDirectory";
import { useMarketAvailability } from "@/lib/useMarketAvailability";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import HelpWidget from "@/components/marketing/HelpWidget";
import LanguagePrompt from "@/components/marketing/LanguagePrompt";
import { useT } from "@/lib/locale";
import { FlyLayer } from "@/components/marketing/anim";

import Hero from "@/components/marketing/sections/Hero";
import ShopByItemStrip from "@/components/marketing/sections/ShopByItemStrip";
import HowItWorksSection from "@/components/marketing/sections/HowItWorksSection";
import MarketsSection from "@/components/marketing/sections/MarketsSection";
import TrustSection from "@/components/marketing/sections/TrustSection";
import EarnSection from "@/components/marketing/sections/EarnSection";
import FaqSection from "@/components/marketing/sections/FaqSection";
import FinalCtaSection from "@/components/marketing/sections/FinalCtaSection";

const HERO_LIST_ID = "hero-list";

export default function MarketingPage() {
  const t = useT();
  const launchedCount = DIRECTORY_MARKETS.filter((m) => m.status === "pilot").length;

  const { liveMarkets, hours } = useMarketAvailability();

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain-overlay min-h-screen bg-canvas text-ink">
        <MarketingHeader overlay />
        <FlyLayer targetId={HERO_LIST_ID} />

        <main className="relative">
          <Hero caption={t.rider[0]} listId={HERO_LIST_ID} />
          <ShopByItemStrip caption={t.rider[1]} />
          <HowItWorksSection caption={t.rider[2]} />
          <MarketsSection caption={t.rider[3]} launchedCount={launchedCount} liveMarkets={liveMarkets} hours={hours} />
          <TrustSection />
          <EarnSection caption={t.rider[4]} />
          <FaqSection caption={t.rider[5]} />
          <FinalCtaSection caption={t.rider[6]} hours={hours} />
        </main>

        <MarketingFooter />
        <HelpWidget />
        <LanguagePrompt />
      </div>
    </MotionConfig>
  );
}
