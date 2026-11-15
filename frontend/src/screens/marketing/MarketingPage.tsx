"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import { useRouter } from "next/navigation";

import { DIRECTORY_MARKETS, matchSlugToApiMarket } from "@/lib/marketDirectory";
import { getMarketHoursStatus, SSR_SAFE_HOURS } from "@/lib/marketHours";
import { saveGuestDraft } from "@/lib/guestDraft";
import { api } from "@/lib/api";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import HelpWidget from "@/components/marketing/HelpWidget";
import LanguagePrompt from "@/components/marketing/LanguagePrompt";
import { useT } from "@/lib/locale";
import { Reveal, Stagger, StaggerItem } from "@/components/marketing/motion";
import {
  ADD_ITEM_EVENT,
  DrawUnderline,
  Float,
  FlyLayer,
  PopIn,
  WordReveal,
  useTypedPlaceholder,
} from "@/components/marketing/anim";
import { Blob } from "@/components/marketing/Blob";
import Eyebrow from "@/components/marketing/Eyebrow";
import SkyScene from "@/components/marketing/SkyScene";
import HowItWorks from "@/components/marketing/HowItWorks";
import { SectionRider, type RiderArt } from "@/components/marketing/SectionRider";

import tomatoes from "@/assets/illustrations/tomatoes.webp";
import garlic from "@/assets/illustrations/garlic.webp";
import bananas from "@/assets/illustrations/bananas-1.webp";
import pepper from "@/assets/illustrations/pepper.webp";
import onion from "@/assets/illustrations/onion.webp";
import garri from "@/assets/illustrations/garri.webp";
import riceBag from "@/assets/illustrations/rice-bag.webp";
import crayfish from "@/assets/illustrations/crayfish.webp";
import eggs from "@/assets/illustrations/eggs.webp";
import milk from "@/assets/illustrations/milk-carton-1.webp";
import bread from "@/assets/illustrations/bread-loaf-1.webp";
import chicken from "@/assets/illustrations/roast-chicken.webp";
import okra from "@/assets/illustrations/okra.webp";
import carrot from "@/assets/illustrations/carrot.webp";
import conversation from "@/assets/illustrations/agent-customer-conversation.webp";
import trustChatTomato from "@/assets/illustrations/trust-chat-tomato.webp";
import finalCtaKitchen from "@/assets/illustrations/final-cta-kitchen.webp";
import riderHero from "@/assets/illustrations/rider-narrator.webp";
import riderCart from "@/assets/illustrations/shopping-cart.webp";
import riderScooterAgent from "@/assets/illustrations/rider-scooter-basket-2.webp";
import riderBicycle from "@/assets/illustrations/rider-bicycle.webp";
import riderScooterBasket from "@/assets/illustrations/rider-scooter-basket-1.webp";
import momoHandoff from "@/assets/illustrations/momo-handoff.webp";
import earnAgentPose from "@/assets/illustrations/char-agent-phone-black.webp";
import earnRiderPose from "@/assets/illustrations/char-rider-scooter.webp";
import squiggle2 from "@/assets/illustrations/decorative-squiggle-2.webp";
import basket from "@/assets/illustrations/grocery-basket.webp";

// What people tap to start a list - Chowdeck's cuisine strip, but for the
// market. Tapping one drops it straight into the list box above.
const QUICK_ITEMS = [
  { label: "Tomatoes", add: "Tomatoes, 1 basket", src: tomatoes },
  { label: "Pepper", add: "Fresh pepper, 1 paint", src: pepper },
  { label: "Onions", add: "Onions, 1 bag", src: onion },
  { label: "Garri", add: "Garri, 2 cups", src: garri },
  { label: "Rice", add: "Rice, 1 bag", src: riceBag },
  { label: "Crayfish", add: "Crayfish, 1 cup", src: crayfish },
  { label: "Eggs", add: "Eggs, 1 crate", src: eggs },
  { label: "Chicken", add: "Chicken, 1 whole", src: chicken },
  { label: "Milk", add: "Milk, 2 cartons", src: milk },
  { label: "Bread", add: "Bread, 2 loaves", src: bread },
  { label: "Okra", add: "Okra, 1 bowl", src: okra },
  { label: "Carrots", add: "Carrots, 1 kg", src: carrot },
  { label: "Bananas", add: "Bananas, 1 bunch", src: bananas },
];

const TRUST_ICONS = ["wallet", "chat", "person", "help"] as const;

function TrustIcon({ kind }: { kind: (typeof TRUST_ICONS)[number] }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "wallet")
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v2h-3.5a3 3 0 0 0 0 6H18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" {...p} />
        <circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (kind === "chat")
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path d="M4 12a8 8 0 1 1 3.3 6.46L4 19.5l1.1-3.4A7.96 7.96 0 0 1 4 12Z" {...p} />
        <circle cx="9" cy="12" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  if (kind === "person")
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <circle cx="12" cy="8.3" r="3.3" {...p} />
        <path d="M5 20c1-4 4-5.9 7-5.9s6 1.9 7 5.9" {...p} />
        <path d="M9.3 14.7l1.9 1.9 3.4-3.4" {...p} strokeWidth={1.6} />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path d="M4.5 13v-1a7.5 7.5 0 0 1 15 0v1" {...p} />
      <rect x="2.5" y="13" width="4" height="6" rx="1.6" {...p} />
      <rect x="17.5" y="13" width="4" height="6" rx="1.6" {...p} />
      <path d="M19.5 19v.5a2 2 0 0 1-2 2h-1.2" {...p} />
    </svg>
  );
}

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

// ── Hero list builder ─────────────────────────────────────────────────────
// Quick-add items carry a quantity the person can change, so the hero list is
// a real mini-list (icon, name, stepper) rather than a pile of fixed strings.
type ListItem = { name: string; qty: number; unit: string; src?: StaticImageData };

const UNIT_PLURAL: Record<string, string> = { loaf: "loaves", kg: "kg", whole: "whole" };
const unitFor = (unit: string, qty: number) =>
  qty === 1 ? unit : UNIT_PLURAL[unit] ?? unit + "s";
const unitBase = (unit: string) => {
  if (unit === "loaves") return "loaf";
  return unit in UNIT_PLURAL ? unit : unit.replace(/s$/, "");
};

// "Garri, 2 cups" -> { name: "Garri", qty: 2, unit: "cup" }
function parseLine(line: string): ListItem {
  const m = line.match(/^(.*?),\s*(\d+(?:\.\d+)?)\s+(.+)$/);
  const src = QUICK_ITEMS.find((q) => q.add === line)?.src;
  if (!m) return { name: line, qty: 1, unit: "", src };
  return { name: m[1], qty: Number(m[2]), unit: unitBase(m[3]), src };
}
const formatItem = (i: ListItem) => (i.unit ? `${i.name}, ${i.qty} ${unitFor(i.unit, i.qty)}` : i.name);

function ListStarter({ id }: { id: string }) {
  const router = useRouter();
  const t = useT();
  const [text, setText] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [flash, setFlash] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const placeholder = useTypedPlaceholder(t.hero.placeholders, !text && !focused && items.length === 0);

  // Tapping something already on the list adds one more instead of ignoring it.
  function addItem(line: string) {
    const next = parseLine(line);
    setItems((cur) =>
      cur.some((i) => i.name === next.name)
        ? cur.map((i) => (i.name === next.name ? { ...i, qty: i.qty + 1 } : i))
        : [...cur, next]
    );
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
  }
  function step(name: string, by: number) {
    setItems((cur) =>
      cur.flatMap((i) => {
        if (i.name !== name) return [i];
        const qty = i.qty + by;
        return qty < 1 ? [] : [{ ...i, qty }];
      })
    );
  }
  function removeItem(name: string) {
    setItems((cur) => cur.filter((i) => i.name !== name));
  }

  // The "What are you cooking?" strip further down feeds this same list.
  useEffect(() => {
    const onAdd = (e: Event) => addItem((e as CustomEvent<{ line: string }>).detail.line);
    window.addEventListener(ADD_ITEM_EVENT, onAdd);
    return () => window.removeEventListener(ADD_ITEM_EVENT, onAdd);
  }, []);

  async function start(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const list = [...items.map(formatItem), text.trim()].filter(Boolean).join("\n");
      if (list) {
        // Loaded on demand so the landing page doesn't ship the list builder.
        const { buildDraft } = await import("@/components/ListBuilder");
        const draft = buildDraft("freetext", [{ item: "", price: "", qty: "1", note: "" }], list, "");
        saveGuestDraft({ marketId: null, step: "list", stagedList: draft, address: "", marketSlug: null });
      }
    } catch {
      /* fall through - the shop still opens, just with an empty list */
    }
    router.push("/shop");
  }

  const count = items.length;

  return (
    <form
      onSubmit={start}
      aria-label="Start your list"
      className={
        "rounded-[2rem] border bg-white/95 p-2.5 text-left shadow-[0_6px_20px_-10px_rgba(120,70,30,0.2)] backdrop-blur transition-shadow duration-300 sm:p-3 " +
        (flash ? "border-brand-orange ring-4 ring-brand-orange/30" : "border-white")
      }
    >
      <div className="flex items-center gap-2 rounded-full bg-canvas py-1.5 pl-5 pr-1.5 ring-1 ring-line transition focus-within:ring-2 focus-within:ring-brand-orange sm:gap-3">
        <label htmlFor={id} className="sr-only">{t.hero.listLabel}</label>
        <input
          id={id}
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || t.hero.searchPlaceholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-ink placeholder:text-faint focus:outline-none sm:text-lg"
        />
        <button
          type="submit"
          disabled={busy}
          className="group/cta inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-brand-orange px-5 font-display text-base font-bold text-[#1A1A1A] transition hover:bg-brand-orange-dark active:scale-[0.98] disabled:opacity-60 sm:px-7"
        >
          {busy ? t.hero.opening : t.hero.button}
          <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform group-hover/cta:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <QuickPicks added={items} onPick={addItem} />

      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.div
            key="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-line px-1 pt-3">
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="font-display text-sm font-extrabold text-ink">
                  Your list <span className="font-semibold text-faint">· {count} {count === 1 ? "item" : "items"}</span>
                </span>
                <button type="button" onClick={() => setItems([])} className="text-xs font-semibold text-faint transition hover:text-ink">
                  Clear
                </button>
              </div>
              <ul className="grid max-h-44 gap-1.5 overflow-y-auto sm:grid-cols-2">
                <AnimatePresence initial={false}>
                  {items.map((i) => (
                    <motion.li
                      key={i.name}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-center gap-2.5 rounded-2xl bg-canvas py-1.5 pl-2 pr-1.5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-line">
                        {i.src && <Image src={i.src} alt="" aria-hidden className="h-6 w-6 object-contain" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{i.name}</span>
                        <span className="block text-xs text-muted">{i.unit ? unitFor(i.unit, i.qty) : ""}</span>
                      </span>
                      <span className="flex items-center rounded-full bg-white ring-1 ring-line">
                        <button type="button" onClick={() => step(i.name, -1)} aria-label={`Less ${i.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition hover:bg-sunken active:scale-90">
                          {i.qty === 1 ? (
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 12h14" strokeLinecap="round" /></svg>
                          )}
                        </button>
                        <span className="w-6 text-center font-display text-sm font-extrabold tabular-nums text-ink" aria-live="polite">{i.qty}</span>
                        <button type="button" onClick={() => step(i.name, 1)} aria-label={`More ${i.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition hover:bg-sunken active:scale-90">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                        </button>
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function QuickPicks({ added, onPick }: { added: ListItem[]; onPick: (line: string) => void }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-1 pb-1 pt-3">
      <span className="text-sm font-semibold text-faint">{t.hero.tapToAdd}</span>
      {QUICK_ITEMS.slice(0, 5).map((q) => {
        const name = parseLine(q.add).name;
        const qty = added.find((i) => i.name === name)?.qty ?? 0;
        return (
          <button
            key={q.label}
            type="button"
            onClick={() => onPick(q.add)}
            className={
              "inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3.5 text-sm font-semibold text-ink transition active:scale-95 " +
              (qty ? "bg-brand-orange" : "bg-[#FBE7D5] hover:bg-brand-orange/60")
            }
          >
            <Image src={q.src} alt="" aria-hidden className="h-6 w-6 object-contain" />
            {q.label}
            {qty > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-extrabold tabular-nums">{qty}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Shared section head: the hero's pill eyebrow + display headline whose
// closing word is picked out in burnt peach, so every section opens the same
// way the hero does.
function SectionHeadInline({ eyebrow, title }: { eyebrow: string; title: string }) {
  const w = title.trim().split(" ");
  const last = w.pop();
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 font-display text-[clamp(2.1rem,4.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-balance text-ink">
        {w.join(" ")} <span className="text-brand-orange-dark">{last}</span>
      </h2>
    </>
  );
}

function SectionHead({
  eyebrow,
  title,
  sub,
  align = "center",
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
  children?: React.ReactNode;
}) {
  const w = title.trim().split(" ");
  const last = w.pop();
  const center = align === "center";
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 font-display text-[clamp(2.1rem,4.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-balance text-ink">
        {w.join(" ")} <span className="text-brand-orange-dark">{last}</span>
      </h2>
      {sub && <p className={"mt-3 text-lg text-muted " + (center ? "mx-auto max-w-xl" : "")}>{sub}</p>}
      {children}
    </Reveal>
  );
}

// One narrator per section, chosen to match what that section is saying.
// Art with lettering on it (QYKA boxes) only ever rides left to right so it
// never mirrors.
const RIDER_ART: Record<string, RiderArt> = {
  hero: { src: riderHero, size: "w-24 sm:w-32 lg:w-36", bump: true },
  tap: { src: riderCart, size: "w-10 sm:w-14 lg:w-16" },
  agent: { src: riderScooterAgent, size: "w-20 sm:w-28 lg:w-32", bump: true },
  markets: { src: riderBicycle, size: "w-20 sm:w-28 lg:w-32", bump: true },
  earn: { src: riderScooterBasket, size: "w-20 sm:w-28 lg:w-32", bump: true },
  faq: { src: conversation, size: "w-24 sm:w-32 lg:w-40" },
  delivered: { src: momoHandoff, size: "w-28 sm:w-40 lg:w-48" },
};

export default function MarketingPage() {
  const t = useT();
  const launchedCount = DIRECTORY_MARKETS.filter((m) => m.status === "pilot").length;

  // Live is_active per market, and the shared shopping window (see marketHours.ts).
  // Null liveMarkets = still loading; treat pilot markets as active so the cards
  // don't flash "soon" before the fetch resolves.
  const [liveMarkets, setLiveMarkets] = useState<any[] | null>(null);
  useEffect(() => {
    api.getMarkets().then(setLiveMarkets).catch(() => setLiveMarkets([]));
  }, []);

  const [hours, setHours] = useState(SSR_SAFE_HOURS);
  useEffect(() => {
    setHours(getMarketHoursStatus());
    const id = setInterval(() => setHours(getMarketHoursStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-canvas text-ink">
      <MarketingHeader overlay />
      <FlyLayer targetId="hero-list" />

      <main className="relative">
        {/* HERO */}
        <section className="relative -mt-16 flex min-h-[100svh] flex-col overflow-hidden pt-16 sm:-mt-[72px] sm:pt-[72px]">
          <SkyScene />
          <SectionRider caption={t.rider[0]} art={RIDER_ART.hero} first />
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
                <ListStarter id="hero-list" />
              </div>
            </div>
          </div>
        </section>

        {/* SHOP BY ITEM - Chowdeck-style scroller */}
        <section className="relative border-y border-line bg-surface">
          <SectionRider caption={t.rider[1]} art={RIDER_ART.tap} mode="pulse" corner />
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

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="relative scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionRider caption={t.rider[2]} art={RIDER_ART.agent} dir="rtl" />
          <SectionHead eyebrow={t.how.eyebrow} title={t.how.title} />
          <HowItWorks />
        </section>

        {/* MARKETS */}
        <section id="markets" className="relative scroll-mt-24 border-y border-line bg-surface">
          <SectionRider caption={t.rider[3]} art={RIDER_ART.markets} />
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <SectionHead eyebrow={t.markets.eyebrow} title={t.markets.title} sub={t.markets.sub(launchedCount)}>
              <Link href="/markets" className="mt-4 inline-flex items-center rounded-full border border-line bg-white px-5 py-2 font-display text-sm font-bold text-ink shadow-sm transition hover:border-brand-orange hover:bg-[#FBE7D5]">
                {t.markets.all}
              </Link>
            </SectionHead>
            <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.09}>
              {DIRECTORY_MARKETS.slice(0, 6).map((m) => {
                const launched = m.status === "pilot";
                // null liveMarkets = still loading - assume active so the badge
                // doesn't flash "soon" before the fetch resolves.
                const live = launched && liveMarkets ? matchSlugToApiMarket(m.id, liveMarkets) : null;
                const inactive = launched && liveMarkets && liveMarkets.length > 0 && live?.is_active === false;
                const status: "open" | "closed" | "soon" = !launched || inactive ? "soon" : hours.open ? "open" : "closed";

                return (
                  <StaggerItem key={m.id} y={32}>
                  <Link
                    href={status === "open" ? `/shop?market=${m.id}` : `/markets/${m.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-line bg-canvas transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="relative h-40 overflow-hidden">
                      <Image
                        src={m.image}
                        alt=""
                        aria-hidden
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0" />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-xl font-extrabold">{m.name}</h3>
                        <span
                          className={
                            "shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold " +
                            (status === "open"
                              ? "bg-brand-green/15 text-brand-green"
                              : status === "closed"
                                ? "bg-sunken text-faint"
                                : "bg-brand-orange/20 text-brand-orange-dark")
                          }
                        >
                          {status === "open" && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-green align-middle" />}
                          {status === "open" ? t.markets.open : status === "closed" ? t.markets.closed : t.markets.soon}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-faint">
                        {m.city} · {m.venueType === "supermarket" ? t.markets.supermarket : t.markets.local}
                        {status === "open" && <> · {t.markets.closesAt(hours.closesAtClock)}</>}
                        {status === "closed" && <> · {t.markets.opensAt(hours.opensAtClock)}</>}
                      </p>
                      <p className="mt-2 line-clamp-2 text-muted">{m.blurb}</p>
                      <span className="mt-4 font-display text-sm font-bold text-ink">
                        {status === "open" ? t.markets.startHere : status === "closed" ? t.markets.comeBack : t.markets.notify}
                      </span>
                    </div>
                  </Link>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </section>

        {/* TRUST */}
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

        {/* EARN */}
        <section className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <SectionRider caption={t.rider[4]} art={RIDER_ART.earn} dir="rtl" />
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

        {/* FAQ */}
        <section id="faq" className="relative scroll-mt-24 border-t border-line bg-surface">
          <SectionRider caption={t.rider[5]} art={RIDER_ART.faq} mode="still" at={6} />
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

        {/* FINAL CTA - the payoff scene: groceries already unpacked on the
            customer's own counter, "order completed" on the phone. Real
            illustration now, replacing the old scattered basket/produce
            sprites (that piece already shows a basket, tomatoes and
            peppers, so those separate floating pieces were redundant). */}
        <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionRider caption={t.rider[6]} art={RIDER_ART.delivered} mode="still" at={6} />
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
      </main>

      <MarketingFooter />
      <HelpWidget />
      <LanguagePrompt />
    </div>
    </MotionConfig>
  );
}
