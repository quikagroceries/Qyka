import Link from "next/link";
import Image from "next/image";

import type { MarketHoursStatus } from "@/lib/marketHours";
import { useT } from "@/lib/locale";
import { Reveal } from "@/components/marketing/motion";
import { Float, PopIn } from "@/components/marketing/anim";
import { Blob } from "@/components/marketing/Blob";
import { SectionRider, type RiderArt } from "@/components/marketing/SectionRider";

import momoHandoff from "@/assets/illustrations/momo-handoff.webp";
import finalCtaKitchen from "@/assets/illustrations/final-cta-kitchen.webp";

const RIDER_ART: RiderArt = { src: momoHandoff, size: "w-28 sm:w-40 lg:w-48" };

// The payoff scene: groceries already unpacked on the customer's own
// counter, "order completed" on the phone.
export default function FinalCtaSection({ caption, hours }: { caption: string; hours: MarketHoursStatus }) {
  const t = useT();
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionRider caption={caption} art={RIDER_ART} mode="still" at={6} />
      <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/30 blur-3xl" />
      <div className="relative grid items-center gap-8 overflow-hidden rounded-[2rem] bg-[#FBE7D5] p-7 sm:p-12 lg:grid-cols-2">
        <Reveal className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-ink ring-1 ring-black/5">
            <span className={"h-1.5 w-1.5 rounded-full bg-brand-green " + (hours.open ? "animate-pulse" : "opacity-40")} />
            {hours.open
              ? `${t.cta.liveOpen} · ${t.markets.closesAt(hours.closesAtClock)}`
              : `${t.cta.liveClosed} · ${t.markets.opensAt(hours.opensAtClock)}`}
          </span>
          <h2 className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-tight tracking-tight text-ink">
            {t.cta.title}
          </h2>
          <p className="mt-3 text-lg text-ink/70">{t.cta.body}</p>
          <Link
            href="/shop"
            className="group/cta2 mt-7 inline-flex min-h-[56px] items-center gap-2 rounded-full bg-brand-orange px-8 font-display text-lg font-bold text-[#1A1A1A] shadow-md transition hover:bg-brand-orange-dark hover:shadow-lg active:scale-[0.98]"
          >
            {t.cta.button}
            <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform group-hover/cta2:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <p className="mt-4 text-sm font-semibold text-ink/60">{t.hero.fine}</p>
        </Reveal>
        <PopIn inView from={{ scale: 0.9, y: 24 }} className="relative">
          <Float amp={4} dur={5}>
            <Blob className="aspect-square w-full">
              <Image
                src={finalCtaKitchen}
                alt="Fresh groceries unpacked on a kitchen counter, order completed"
                className="h-full w-full object-contain"
              />
            </Blob>
          </Float>
          <Float amp={4} dur={4.5} delay={0.5} className="absolute left-0 top-2 sm:left-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-md ring-1 ring-line">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand-orange-dark" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden><path d="M20.6 12.3 12.7 20a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8l7.7-7.7A2 2 0 0 1 13 3h5a2 2 0 0 1 2 2v5a2 2 0 0 1-.4 1.3Z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" /></svg>
              {t.cta.noMarkup}
            </span>
          </Float>
        </PopIn>
      </div>
    </section>
  );
}
