import Link from "next/link";
import Image from "next/image";

import { useT } from "@/lib/locale";
import { Reveal } from "@/components/marketing/motion";
import { Float } from "@/components/marketing/anim";
import { SectionRider, type RiderArt } from "@/components/marketing/SectionRider";

import riderScooterBasket from "@/assets/illustrations/rider-scooter-basket-1.webp";
import earnAgentPose from "@/assets/illustrations/char-agent-phone-black.webp";
import earnRiderPose from "@/assets/illustrations/char-rider-scooter.webp";

const RIDER_ART: RiderArt = { src: riderScooterBasket, size: "w-20 sm:w-28 lg:w-32", bump: true };

export default function EarnSection({ caption }: { caption: string }) {
  const t = useT();
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
      <SectionRider caption={caption} art={RIDER_ART} dir="rtl" />
      <div className="grid gap-5 md:grid-cols-2">
        <Reveal x={-36} y={0} className="h-full">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-brand-orange p-7 sm:p-9">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-[#1A1A1A] sm:text-4xl">
              {t.earn.agent.title}
            </h2>
            <p className="mt-2 max-w-sm text-[#1A1A1A]/80">{t.earn.agent.body}</p>
            <Link
              href="/for-agents"
              className="mt-6 inline-flex min-h-[48px] w-fit items-center rounded-full bg-surface px-6 font-display font-bold text-ink shadow-sm transition hover:bg-canvas active:scale-[0.98]"
            >
              {t.earn.agent.cta}
            </Link>
            <div className="mt-6 rounded-3xl bg-surface p-3">
              <Float amp={4} dur={3.8}><Image src={earnAgentPose} alt="" aria-hidden className="mx-auto h-44 object-contain" /></Float>
            </div>
          </div>
        </Reveal>
        <Reveal x={36} y={0} className="h-full">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-line bg-surface p-7 shadow-sm sm:p-9">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
              {t.earn.rider.title}
            </h2>
            <p className="mt-2 max-w-sm text-muted">{t.earn.rider.body}</p>
            <Link
              href="/for-riders"
              className="mt-6 inline-flex min-h-[48px] w-fit items-center rounded-full bg-brand-orange px-6 font-display font-bold text-[#1A1A1A] shadow-sm transition hover:bg-brand-orange-dark active:scale-[0.98]"
            >
              {t.earn.rider.cta}
            </Link>
            <Float amp={4} dur={3.2}><Image src={earnRiderPose} alt="" aria-hidden className="mx-auto mt-6 h-52 object-contain" /></Float>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
