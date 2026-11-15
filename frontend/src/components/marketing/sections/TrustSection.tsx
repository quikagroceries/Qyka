import Image from "next/image";

import { useT } from "@/lib/locale";
import { Reveal, Stagger, StaggerItem } from "@/components/marketing/motion";
import { Float } from "@/components/marketing/anim";
import { SectionHeadInline } from "@/components/marketing/SectionHead";
import TrustIcon, { TRUST_ICONS } from "@/components/marketing/icons/TrustIcon";

import trustChatTomato from "@/assets/illustrations/trust-chat-tomato.webp";

export default function TrustSection() {
  const t = useT();
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface p-6 shadow-sm sm:p-10 lg:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-orange/10 blur-3xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <Reveal x={-30} y={0}>
            <SectionHeadInline eyebrow={t.trust.eyebrow} title={t.trust.title} />
            <Stagger className="mt-8 grid gap-4 sm:grid-cols-2" stagger={0.08}>
              {TRUST_ICONS.map((kind, ti) => (
                <StaggerItem key={ti} y={20}>
                  <div className="group flex h-full gap-3 rounded-2xl border border-transparent p-2 transition hover:-translate-y-0.5 hover:border-line hover:bg-canvas hover:shadow-sm">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FBE7D5] text-brand-orange-dark transition duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <TrustIcon kind={kind} />
                    </span>
                    <div>
                      <h3 className="font-display font-bold text-ink">{t.trust.points[ti].title}</h3>
                      <p className="text-sm text-muted">{t.trust.points[ti].body}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>
          <Reveal x={30} y={0} className="relative">
            <div className="absolute inset-4 rotate-2 rounded-[2rem] bg-brand-orange/25" />
            <Float amp={5} dur={5}>
              <Image
                src={trustChatTomato}
                alt="An agent sending a photo of fresh tomatoes before buying them"
                className="relative mx-auto w-full max-w-md object-contain"
              />
            </Float>
            <Float amp={4} dur={4.5} delay={0.4} className="absolute right-2 top-6 sm:right-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-md ring-1 ring-line">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand-green" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {t.trust.badgeVerified}
              </span>
            </Float>
            <Float amp={4} dur={5} delay={0.9} className="absolute right-2 top-20 sm:right-4 sm:top-24">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-md ring-1 ring-line">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand-orange" fill="currentColor" stroke="none" aria-hidden><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" /></svg>
                {t.trust.badgeRated}
              </span>
            </Float>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
