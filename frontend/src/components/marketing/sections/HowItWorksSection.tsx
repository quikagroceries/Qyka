import { useT } from "@/lib/locale";
import { SectionRider, type RiderArt } from "@/components/marketing/SectionRider";
import SectionHead from "@/components/marketing/SectionHead";
import HowItWorks from "@/components/marketing/HowItWorks";

import riderScooterAgent from "@/assets/illustrations/rider-scooter-basket-2.webp";

const RIDER_ART: RiderArt = { src: riderScooterAgent, size: "w-20 sm:w-28 lg:w-32", bump: true };

export default function HowItWorksSection({ caption }: { caption: string }) {
  const t = useT();
  return (
    <section id="how-it-works" className="relative scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionRider caption={caption} art={RIDER_ART} dir="rtl" />
      <SectionHead eyebrow={t.how.eyebrow} title={t.how.title} />
      <HowItWorks />
    </section>
  );
}
