import { Metadata } from "next";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import AnnouncementBar from "@/components/marketing/AnnouncementBar";
import StickyCta from "@/components/marketing/StickyCta";
import HelpWidget from "@/components/marketing/HelpWidget";
import { Section } from "@/components/marketing/Section";
import PricingCalculator from "@/components/marketing/PricingCalculator";
import Eyebrow from "@/components/marketing/Eyebrow";
import { LANDING } from "@/content/landing";
import { getLiveFees } from "@/lib/serverPricing";
import MarketingCard from "@/components/marketing/MarketingCard";
import { MarketingLinkButton } from "@/components/marketing/MarketingButton";
import Image from "next/image";
import { Float } from "@/components/marketing/anim";
import squiggle1 from "@/assets/illustrations/decorative-squiggle-1.webp";
import vendorScale from "@/assets/illustrations/vendor-weighing-scale.webp";

export const metadata: Metadata = {
  title: "Pricing — Transparent Market Fees | Qyka",
  description: "Simple, transparent pricing for grocery delivery. No hidden fees, no markup on food.",
};

export default async function PricingPage() {
  const fees = await getLiveFees();
  const paymentFaq = LANDING.faq.groups.find(g => g.name === "Payment");

  return (
    <div className="grain-overlay bg-canvas text-ink min-h-screen flex flex-col font-sans selection:bg-brand-orange/20">
      <AnnouncementBar />
      <MarketingHeader />
      
      <main className="flex-1">
        {/* Hero */}
        <Section className="relative overflow-hidden py-16 sm:py-24 lg:py-32 bg-surface">
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-brand-orange/15 blur-3xl" aria-hidden />
          <Image
            src={squiggle1}
            alt=""
            aria-hidden
            className="pointer-events-none absolute right-[6%] top-10 hidden w-16 rotate-12 opacity-[0.3] lg:block"
          />
          <Float amp={5} dur={5} className="pointer-events-none absolute left-[3%] top-12 hidden w-40 -rotate-6 xl:block">
            <Image src={vendorScale} alt="" aria-hidden className="w-full" />
          </Float>
          <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <Eyebrow className="text-center">Pricing</Eyebrow>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Simple, transparent pricing. <br className="hidden sm:block" />
              <span className="text-brand-orange-dark">No surprises.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-12">
              You pay what the vendor charges, plus a flat service and delivery fee. We never mark up the price of your food.
            </p>
            
            <div className="max-w-xl mx-auto text-left">
              <PricingCalculator />
            </div>
          </div>
        </Section>

        {/* Breakdown & Comparison */}
        <Section className="py-16 sm:py-24 bg-canvas-deep">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="font-display text-2xl font-bold mb-6">What makes up the price</h2>
                <ul className="space-y-4">
                  <li className="flex gap-4 p-4 bg-surface rounded-2xl border border-line shadow-sm">
                    <div className="font-bold text-lg min-w-[60px]">0%</div>
                    <div>
                      <h3 className="font-bold">Groceries at cost</h3>
                      <p className="text-sm text-muted">We don&apos;t mark up items. You pay what the vendor charges.</p>
                    </div>
                  </li>
                  <li className="flex gap-4 p-4 bg-surface rounded-2xl border border-line shadow-sm">
                    <div className="font-bold text-lg min-w-[60px]">{fees.serviceFeePercent}%</div>
                    <div>
                      <h3 className="font-bold">Service fee</h3>
                      <p className="text-sm text-muted">Covers agent effort, bargaining, and platform processing.</p>
                    </div>
                  </li>
                  <li className="flex gap-4 p-4 bg-surface rounded-2xl border border-line shadow-sm">
                    <div className="font-bold text-lg min-w-[60px]">₦{fees.deliveryFee.toLocaleString()}</div>
                    <div>
                      <h3 className="font-bold">Delivery fee</h3>
                      <p className="text-sm text-muted">A flat fee that pays the shopkeeper who checks your order in at the market hub and the rider who brings it to your door.</p>
                    </div>
                  </li>
                  <li className="flex gap-4 p-4 bg-surface rounded-2xl border border-line shadow-sm">
                    <div className="font-bold text-lg min-w-[60px]">₦{fees.addItemFee.toLocaleString()}</div>
                    <div>
                      <h3 className="font-bold">Add-item fee</h3>
                      <p className="text-sm text-muted">Only applies if you add items after the shopping run has started.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold mb-6">How we compare</h2>
                <div className="bg-surface rounded-[2rem] border border-line overflow-hidden">
                  <div className="grid grid-cols-2 border-b border-line bg-canvas-deep">
                    <div className="p-4 font-bold text-muted border-r border-line">Traditional apps</div>
                    <div className="p-4 font-bold text-brand-orange-dark">Qyka</div>
                  </div>
                  <div className="grid grid-cols-2 border-b border-line">
                    <div className="p-4 text-sm border-r border-line text-muted">15-30% food markup</div>
                    <div className="p-4 text-sm font-semibold">0% food markup</div>
                  </div>
                  <div className="grid grid-cols-2 border-b border-line">
                    <div className="p-4 text-sm border-r border-line text-muted">Hidden service fees</div>
                    <div className="p-4 text-sm font-semibold">Transparent {fees.serviceFeePercent}%</div>
                  </div>
                  <div className="grid grid-cols-2 border-b border-line">
                    <div className="p-4 text-sm border-r border-line text-muted">Algorithm pricing</div>
                    <div className="p-4 text-sm font-semibold">Real vendor receipts</div>
                  </div>
                  <div className="grid grid-cols-2">
                    <div className="p-4 text-sm border-r border-line text-muted">Support tickets</div>
                    <div className="p-4 text-sm font-semibold">Live chat with your agent</div>
                  </div>
                </div>

                <div className="mt-8 bg-surface p-6 rounded-[2rem] border border-line">
                  <h3 className="font-bold mb-2">Refund policy</h3>
                  <p className="text-sm text-muted">
                    You only ever pay for what is actually purchased plus delivery and service fee. Unspent deposits are refunded to your wallet within 24 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Included/Not Included */}
        <Section className="py-16 sm:py-24 bg-surface">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 gap-8">
              <div>
                <h3 className="font-display text-xl font-bold mb-4">What&apos;s included</h3>
                <ul className="space-y-3">
                  {LANDING.pricing.included.map((item, i) => (
                    <li key={i} className="flex gap-3 text-muted items-start">
                      <svg className="w-5 h-5 text-brand-green shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-display text-xl font-bold mb-4">What&apos;s NOT included</h3>
                <ul className="space-y-3">
                  {LANDING.pricing.notIncluded.map((item, i) => (
                    <li key={i} className="flex gap-3 text-muted items-start">
                      <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* FAQ Snippet */}
        {paymentFaq && (
          <Section className="py-16 sm:py-24 bg-canvas-deep">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="font-display text-3xl font-bold mb-8 text-center">Frequently asked questions</h2>
              <div className="space-y-6">
                {paymentFaq.questions.map((q, i) => (
                  <MarketingCard key={i} className="p-6">
                    <h3 className="font-bold text-lg mb-2">{q.q}</h3>
                    <p className="text-muted">{q.a}</p>
                  </MarketingCard>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* CTA */}
        <Section className="py-16 sm:py-24 bg-surface text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold mb-6">Ready to save time and money?</h2>
            <MarketingLinkButton href="/shop">Start your list</MarketingLinkButton>
          </div>
        </Section>
      </main>

      <MarketingFooter />
      <StickyCta />
      <HelpWidget />
    </div>
  );
}
