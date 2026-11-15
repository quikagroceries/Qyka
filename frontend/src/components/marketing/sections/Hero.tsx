import { useT } from "@/lib/locale";
import { Reveal } from "@/components/marketing/motion";
import { DrawUnderline, WordReveal } from "@/components/marketing/anim";
import Eyebrow from "@/components/marketing/Eyebrow";
import SkyScene from "@/components/marketing/SkyScene";
import { SectionRider, type RiderArt } from "@/components/marketing/SectionRider";
import ListStarter from "@/components/marketing/hero/ListStarter";

import riderHero from "@/assets/illustrations/rider-narrator.webp";

const RIDER_ART: RiderArt = { src: riderHero, size: "w-24 sm:w-32 lg:w-36", bump: true };

export default function Hero({ caption, listId }: { caption: string; listId: string }) {
  const t = useT();
  return (
    <section className="relative -mt-16 flex min-h-[100svh] flex-col overflow-hidden pt-16 sm:-mt-[72px] sm:pt-[72px]">
      <SkyScene />
      <SectionRider caption={caption} art={RIDER_ART} first />
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-10 pt-8 text-center sm:px-6 sm:pt-12 lg:pt-16">
        <div className="relative z-10">
          <Eyebrow>{t.hero.eyebrow}</Eyebrow>
          <h1 className="mt-3 font-display text-[clamp(2.7rem,7.4vw,5.4rem)] font-extrabold leading-[1] tracking-[-0.035em] text-ink">
            <span className="block"><WordReveal key={t.hero.titleA} text={t.hero.titleA} /></span>
            {(() => {
              // Line two: first word in burnt peach with the hand-drawn
              // underline, the rest in ink.
              const w = t.hero.titleB.split(" ");
              const head = w[0];
              const rest = w.slice(1).join(" ");
              return (
                <span className="block">
                  <span className="relative inline-block text-brand-orange-dark">
                    <WordReveal key={head} text={head} delay={0.25} />
                    <DrawUnderline delay={0.9} />
                  </span>
                  {rest && <>{" "}<WordReveal key={rest} text={rest} delay={0.35} /></>}
                </span>
              );
            })()}
          </h1>
          <Reveal y={16} delay={0.35}>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted sm:text-xl">
              {t.hero.sub}
            </p>
          </Reveal>
          <div className="mx-auto mt-9 max-w-3xl">
            <ListStarter id={listId} />
          </div>
        </div>
      </div>
    </section>
  );
}
