import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { DIRECTORY_MARKETS, DirectoryMarket } from "@/lib/marketDirectory";
import { illustrationForCategory } from "@/lib/foodVisuals";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Section } from "@/components/marketing/Section";
import MarketingCard from "@/components/marketing/MarketingCard";
import { MarketingLinkButton } from "@/components/marketing/MarketingButton";
import WavyDivider from "@/components/ui/WavyDivider";
import { HeroIn, Reveal, Stagger, StaggerItem } from "@/components/marketing/motion";
import NotifyMarketForm from "@/components/marketing/NotifyMarketForm";

import marketCartVendor from "@/assets/illustrations/market-cart-vendor.webp";
import marketStallProduce from "@/assets/illustrations/market-stall-produce.webp";
import vendorStallFish from "@/assets/illustrations/vendor-stall-fish.webp";
import squiggle1 from "@/assets/illustrations/decorative-squiggle-1.webp";
import badgeFreshGuarantee from "@/assets/illustrations/badge-fresh-guarantee.webp";
import badgeRealTimeUpdates from "@/assets/illustrations/badge-real-time-updates.webp";
import produceCrate from "@/assets/illustrations/produce-crate.webp";

// Same "pick an illustration for this market" idea as MarketArt.tsx on the
// shop side, simplified to the categories already on the directory entry -
// a fish market gets the fish-stall art, otherwise produce or the general
// cart vendor, rather than every market page reusing one single image.
function heroIllustrationFor(market: DirectoryMarket) {
  if (market.categories.includes("fish")) return vendorStallFish;
  if (market.categories.includes("produce")) return marketStallProduce;
  return marketCartVendor;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return DIRECTORY_MARKETS.map((m) => ({
    slug: m.id,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const market = DIRECTORY_MARKETS.find((m) => m.id === slug);
  if (!market) {
    return {
      title: "Market Not Found — Qyka Groceries",
    };
  }

  return {
    title: `${market.name} — Qyka Groceries`,
    description: market.blurb,
    alternates: {
      canonical: `https://qyka.com/markets/${market.id}`,
    },
  };
}

export default async function MarketPage({ params }: PageProps) {
  const { slug } = await params;
  const market = DIRECTORY_MARKETS.find((m) => m.id === slug);

  if (!market) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": market.venueType === "supermarket" ? "GroceryStore" : "Market",
    name: market.name,
    description: market.blurb,
    address: {
      "@type": "PostalAddress",
      addressLocality: market.city,
      addressRegion: market.state,
      addressCountry: "NG",
    },
    image: `https://qyka.com${market.image}`,
  };

  return (
    <div className="grain-overlay min-h-screen bg-canvas text-ink flex flex-col selection:bg-brand-orange/20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingHeader />

      <main className="flex-1 pb-16">
        <HeroIn>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 overflow-hidden">
            <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-brand-orange/15 blur-3xl" aria-hidden />
            <Image
              src={squiggle1}
              alt=""
              aria-hidden
              className="pointer-events-none absolute right-[8%] top-4 hidden w-14 rotate-[8deg] opacity-[0.3] lg:block"
            />
            <Image
              src={heroIllustrationFor(market)}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -right-4 bottom-0 hidden w-40 lg:block xl:w-48"
            />
            <div className="flex flex-col lg:flex-row gap-12 items-start">
              <div className="w-full lg:w-1/2 rounded-[2rem] overflow-hidden aspect-[4/3] relative shadow-sm border border-line bg-canvas-deep">
                <Image
                  src={market.image}
                  alt={market.name}
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              <div className="w-full lg:w-1/2 flex flex-col pt-4">
                <Link href="/markets" className="text-sm font-semibold text-brand-orange-dark mb-6 inline-flex items-center hover:underline">
                  &larr; Back to all markets
                </Link>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="bg-surface text-ink text-xs font-bold px-3 py-1.5 rounded-full border border-line shadow-sm">
                    {market.venueType === "supermarket" ? "Supermarket" : "Open-air Market"}
                  </span>
                  {market.status === "pilot" ? (
                    <span className="bg-brand-green/15 text-brand-green text-xs font-bold px-3 py-1.5 rounded-full">
                      Live now
                    </span>
                  ) : (
                    <span className="bg-brand-orange/20 text-brand-orange-dark text-xs font-bold px-3 py-1.5 rounded-full">
                      Opening soon
                    </span>
                  )}
                </div>

                <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-ink mb-4 text-balance">
                  {market.name}
                </h1>
                <p className="text-lg text-muted mb-8">{market.city}, {market.state}</p>

                <p className="text-xl text-ink leading-relaxed mb-10 max-w-lg">
                  {market.blurb}
                </p>

                {market.status === "pilot" ? (
                  <MarketingLinkButton href={`/shop?market=${market.id}`} className="max-w-sm w-full">
                    Shop this market now
                  </MarketingLinkButton>
                ) : (
                  <NotifyMarketForm marketLabel={`${market.name} (${market.city})`} />
                )}
              </div>
            </div>
          </div>
        </HeroIn>

        <WavyDivider />

        <Section
          bg="surface"
          eyebrow="In this market"
          title="What you'll find here"
          lede="The categories available when shopping at this location."
        >
          <div className="flex flex-wrap gap-4 mt-8">
            {market.categories.map((cat) => (
              <div key={cat} className="flex flex-col items-center p-6 border border-line rounded-[2rem] bg-surface shadow-sm w-[120px] sm:w-[150px]">
                <div className="w-14 h-14 rounded-full bg-brand-orange/15 mb-4 flex items-center justify-center overflow-hidden">
                  <Image src={illustrationForCategory(cat)} alt="" aria-hidden className="h-10 w-10 object-contain" />
                </div>
                <span className="font-semibold text-ink capitalize">{cat}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          bg="canvas-deep"
          eyebrow="How it works"
          title="How a Qyka agent shops this market"
          lede="Our trained personal shoppers navigate the stalls and aisles so you don't have to."
        >
          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            {[
              { title: "Careful Selection", desc: "Agents check for freshness and quality just like you would, picking the best produce.", art: badgeFreshGuarantee },
              { title: "Real-time Chat", desc: "If an item is out of stock, they message you directly in the app to find a replacement.", art: badgeRealTimeUpdates },
              { title: "Safe Packaging", desc: "Items are packed carefully so nothing gets crushed or spoiled on the way to your door.", art: produceCrate },
            ].map((step, i) => (
              <StaggerItem key={i}>
                <MarketingCard className="h-full">
                  <div className="w-14 h-14 rounded-2xl bg-surface ring-1 ring-line flex items-center justify-center mb-4">
                    <Image src={step.art} alt="" aria-hidden className="h-9 w-9 object-contain" />
                  </div>
                  <h3 className="font-display font-bold text-xl mb-2">{step.title}</h3>
                  <p className="text-muted">{step.desc}</p>
                </MarketingCard>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>

      </main>

      <MarketingFooter />
    </div>
  );
}
