import Image from "next/image";

import { useT } from "@/lib/locale";
import { Reveal } from "@/components/marketing/motion";
import { ADD_ITEM_EVENT } from "@/components/marketing/anim";
import { SectionRider, type RiderArt } from "@/components/marketing/SectionRider";
import { QUICK_ITEMS } from "@/components/marketing/hero/quickItems";

import riderCart from "@/assets/illustrations/shopping-cart.webp";

const RIDER_ART: RiderArt = { src: riderCart, size: "w-10 sm:w-14 lg:w-16" };

// Chowdeck-style scroller: tapping an item flies it into the hero list box.
export default function ShopByItemStrip({ caption }: { caption: string }) {
  const t = useT();
  return (
    <section className="relative border-y border-line bg-surface">
      <SectionRider caption={caption} art={RIDER_ART} mode="pulse" corner />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Reveal y={14}><h2 className="mb-4 font-display text-xl font-extrabold text-ink sm:text-2xl">{t.strip.title}</h2></Reveal>
        <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {QUICK_ITEMS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                window.dispatchEvent(
                  new CustomEvent(ADD_ITEM_EVENT, {
                    detail: { line: q.add, src: q.src.src, from: { left: r.left + r.width / 2 - 28, top: r.top + 16, width: r.width, height: r.height } },
                  })
                );
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="group flex w-24 shrink-0 snap-start flex-col items-center gap-2 sm:w-28"
            >
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-canvas ring-1 ring-line transition group-hover:bg-[#FBE7D5] group-hover:ring-brand-orange sm:h-28 sm:w-28">
                <Image src={q.src} alt="" className="h-14 w-14 object-contain transition duration-300 group-hover:-rotate-6 group-hover:scale-[1.15] group-active:scale-90 sm:h-16 sm:w-16" />
              </span>
              <span className="text-sm font-semibold text-ink">{q.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
