"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { useT } from "@/lib/locale";
import { Stagger, StaggerItem } from "@/components/marketing/motion";
import { SectionRider, type RiderArt } from "@/components/marketing/SectionRider";
import { SectionHeadInline } from "@/components/marketing/SectionHead";

import conversation from "@/assets/illustrations/agent-customer-conversation.webp";

const RIDER_ART: RiderArt = { src: conversation, size: "w-24 sm:w-32 lg:w-40" };

function FaqList() {
  const faq = useT().faq;
  const [category, setCategory] = useState(faq.categories[0]);
  const [open, setOpen] = useState<string | null>(faq.items[0]?.q ?? null);

  const items = category === faq.categories[0] ? faq.items : faq.items.filter((it) => it.category === category);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {faq.categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={
              "rounded-full px-4 py-1.5 text-sm font-bold transition active:scale-95 " +
              (category === c ? "bg-brand-orange text-[#1A1A1A]" : "bg-canvas text-muted ring-1 ring-line hover:bg-[#FBE7D5] hover:text-ink")
            }
          >
            {c}
          </button>
        ))}
      </div>
      <Stagger className="divide-y divide-line rounded-[2rem] border border-line bg-surface px-5 shadow-sm sm:px-8" stagger={0.06}>
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => {
            const isOpen = open === item.q;
            return (
              <StaggerItem key={item.q} y={14}>
                <motion.div layout="position">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : item.q)}
                    aria-expanded={isOpen}
                    className="group flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block font-display text-[0.7rem] font-extrabold uppercase tracking-wide text-brand-orange-dark/80">
                        {item.category}
                      </span>
                      <span className="font-display text-lg font-bold text-ink transition-colors group-hover:text-brand-orange-dark">
                        {item.q}
                      </span>
                    </span>
                    <span
                      className={
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink transition-transform duration-300 " +
                        (isOpen ? "rotate-45 bg-brand-orange" : "group-hover:bg-[#FBE7D5]")
                      }
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="a"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pb-5 leading-relaxed text-muted">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </StaggerItem>
            );
          })}
        </AnimatePresence>
      </Stagger>
    </div>
  );
}

export default function FaqSection({ caption }: { caption: string }) {
  const t = useT();
  return (
    <section id="faq" className="relative scroll-mt-24 border-t border-line bg-surface">
      <SectionRider caption={caption} art={RIDER_ART} mode="still" at={6} />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <SectionHeadInline eyebrow={t.faq.eyebrow} title={t.faq.title} />
          <p className="mt-3 text-lg text-muted">{t.faq.lede}</p>
          <Link href="/help" className="mt-5 inline-flex items-center rounded-full border border-line bg-white px-5 py-2 font-display text-sm font-bold text-ink shadow-sm transition hover:border-brand-orange hover:bg-[#FBE7D5]">
            {t.faq.link}
          </Link>
        </div>
        <FaqList />
      </div>
    </section>
  );
}
