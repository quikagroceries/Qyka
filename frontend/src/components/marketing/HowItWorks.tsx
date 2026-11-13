"use client";

// "How it works" as one interactive stage instead of three static cards.
//
// A step list on the left drives a single stage on the right. The visitor's
// choices travel across the steps, so the story is theirs:
//   1. tap items to build a list
//   2. an agent chats about THOSE items and asks a real swap-or-keep question
//   3. the receipt reflects the swap, money goes back to the wallet, a rider
//      rides the route
// Auto-plays until the visitor touches anything; pauses on hover; honours
// reduced motion (no autoplay, no typing delays, rider parked at the door).

import { useEffect, useMemo, useRef, useState } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";

import { useT } from "@/lib/locale";

import tomatoes from "@/assets/illustrations/tomatoes.webp";
import pepper from "@/assets/illustrations/pepper.webp";
import onion from "@/assets/illustrations/onion.webp";
import garri from "@/assets/illustrations/garri.webp";
import eggs from "@/assets/illustrations/eggs.webp";
import bananas from "@/assets/illustrations/bananas-1.webp";
import riderArt from "@/assets/illustrations/rider-bicycle.webp";
import marketPhoto from "@/assets/illustrations/images.jpeg";

const STEP_MS = 8000;

type DemoItem = {
  id: string;
  name: string;
  unit: string;
  price: number;
  alt: { label: string; price: number };
  src: StaticImageData;
};

// Example prices, shown as such in the UI. The first item on the list is the
// one the agent offers to swap.
const DEMO: DemoItem[] = [
  { id: "tomatoes", name: "Tomatoes", unit: "1 basket", price: 2500, alt: { label: "a smaller basket", price: 1800 }, src: tomatoes },
  { id: "pepper", name: "Fresh pepper", unit: "1 paint", price: 1800, alt: { label: "half a paint", price: 1000 }, src: pepper },
  { id: "onions", name: "Onions", unit: "1 bag", price: 3000, alt: { label: "half a bag", price: 1700 }, src: onion },
  { id: "garri", name: "Garri", unit: "2 cups", price: 1200, alt: { label: "1 cup", price: 700 }, src: garri },
  { id: "eggs", name: "Eggs", unit: "1 crate", price: 4200, alt: { label: "half a crate", price: 2300 }, src: eggs },
  { id: "bananas", name: "Bananas", unit: "1 bunch", price: 1000, alt: { label: "a smaller bunch", price: 600 }, src: bananas },
];

const naira = (n: number) => "₦" + n.toLocaleString("en-NG");
type Choice = "swap" | "keep" | null;

// The delivery map (viewBox 0 0 320 150): a street grid with the market at the
// bottom-left and the customer's door at the top-right. The route turns at
// the corners like a real driving route.
const MAP_W = 320;
const MAP_H = 150;
const ROAD_X = [40, 120, 200, 276];
const ROAD_Y = [34, 96, 138];
const ROAD_HALF = 5;
const START = { x: 40, y: 128 };
const DOOR = { x: 276, y: 34 };
const ROUTE = "M40 128 L40 104 Q40 96 48 96 L192 96 Q200 96 200 88 L200 42 Q200 34 208 34 L276 34";

// City blocks: every gap between roads. One of them is a park.
const XS = [0, ...ROAD_X, MAP_W];
const YS = [0, ...ROAD_Y, MAP_H];
const BLOCKS = XS.slice(0, -1).flatMap((_, i) =>
  YS.slice(0, -1).map((__, j) => {
    const x0 = i === 0 ? 0 : XS[i] + ROAD_HALF;
    const x1 = i === XS.length - 2 ? MAP_W : XS[i + 1] - ROAD_HALF;
    const y0 = j === 0 ? 0 : YS[j] + ROAD_HALF;
    const y1 = j === YS.length - 2 ? MAP_H : YS[j + 1] - ROAD_HALF;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, park: i === 2 && j === 1, tone: (i + j) % 2 };
  })
);
const TREES: [number, number][] = [[140, 54], [160, 72], [180, 52], [150, 84], [184, 80], [132, 72]];

function useCountUp(target: number, run: boolean, off: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (off) return;
    if (!run) {
      setV(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, off]);
  return off ? target : v;
}

const Check = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Step 1: build a list ─────────────────────────────────────────────── */

function ListScene({ items, toggle }: { items: DemoItem[]; toggle: (id: string) => void }) {
  const st = useT().how.stage;
  const picked = new Set(items.map((i) => i.id));
  return (
    <div>
      <div className="rounded-full bg-canvas px-5 py-3 text-base text-faint ring-1 ring-line">{st.inputHint}</div>

      <p className="mt-4 text-sm font-semibold text-faint">{st.tapToAdd}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DEMO.map((d) => {
          const on = picked.has(d.id);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.id)}
              aria-pressed={on}
              className={
                "inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3.5 text-sm font-semibold text-ink transition active:scale-95 " +
                (on ? "bg-brand-orange" : "bg-[#FBE7D5] hover:bg-brand-orange/60")
              }
            >
              <Image src={d.src} alt="" aria-hidden className="h-6 w-6 object-contain" />
              {d.name}
              {on && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="font-display text-sm font-extrabold text-ink">{st.yourList}</span>
          <span className="text-xs font-semibold text-faint">{st.itemCount(items.length)}</span>
        </div>
        {items.length === 0 ? (
          <p className="rounded-2xl bg-canvas px-4 py-6 text-center text-sm text-muted">{st.emptyList}</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {items.map((i) => (
                <motion.li
                  key={i.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2.5 rounded-2xl bg-canvas py-1.5 pl-2 pr-1.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-line">
                    <Image src={i.src} alt="" aria-hidden className="h-6 w-6 object-contain" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{i.name}</span>
                    <span className="block text-xs text-muted">{i.unit}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(i.id)}
                    aria-label={`${st.remove} ${i.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition hover:bg-sunken hover:text-ink active:scale-90"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── Step 2: chat with the agent ──────────────────────────────────────── */

type Msg =
  | { who: "agent" | "you"; kind: "text"; text: string }
  | { who: "agent"; kind: "photo"; item: DemoItem; text: string }
  | { who: "agent"; kind: "ask"; text: string };

function ChatScene({
  items,
  active,
  choice,
  setChoice,
  reduce,
}: {
  items: DemoItem[];
  active: boolean;
  choice: Choice;
  setChoice: (c: Choice) => void;
  reduce: boolean;
}) {
  const st = useT().how.stage;
  const first = items[0];

  const msgs: Msg[] = useMemo(() => {
    if (!first) return [];
    const base: Msg[] = [
      { who: "agent", kind: "text", text: st.hi(items.map((i) => i.name).join(", ")) },
      { who: "agent", kind: "photo", item: first, text: st.photo(first.name, naira(first.price)) },
      { who: "agent", kind: "ask", text: st.pricey(first.name, naira(first.price), first.alt.label, naira(first.alt.price)) },
    ];
    if (!choice) return base;
    return [
      ...base,
      { who: "you", kind: "text", text: choice === "swap" ? st.youSwap : st.youKeep },
      { who: "agent", kind: "text", text: st.done },
    ];
  }, [first, items, choice, st]);

  // Messages arrive one by one; picking an answer only appends, never restarts.
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  shownRef.current = shown;
  useEffect(() => {
    if (!active) {
      setShown(0);
      return;
    }
    if (reduce) {
      setShown(msgs.length);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let delay = 0;
    for (let k = shownRef.current; k < msgs.length; k++) {
      delay += k === 0 ? 450 : 1150;
      timers.push(setTimeout(() => setShown(k + 1), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [active, reduce, msgs.length]);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.parentElement?.scrollTo({ top: 99999, behavior: reduce ? "auto" : "smooth" });
  }, [shown, reduce]);

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl bg-canvas p-2.5">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-orange font-display text-lg font-extrabold text-[#1A1A1A]">
          {st.agentName[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold text-ink">{st.agentName}</p>
          <p className="truncate text-xs text-muted">{st.agentMeta}</p>
        </div>
        <span className="mr-1 inline-flex items-center gap-1.5 rounded-full bg-brand-green/20 px-2.5 py-1 text-xs font-bold text-ink">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-green" />
          {st.online}
        </span>
      </div>

      <div className="mt-3 flex max-h-[24rem] min-h-[18rem] flex-col gap-2 overflow-y-auto pr-1" aria-live="polite">
        {msgs.slice(0, shown).map((m, i) => (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={
              "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm font-semibold shadow-sm " +
              (m.who === "you"
                ? "self-end rounded-br-md bg-brand-orange text-[#1A1A1A]"
                : "self-start rounded-bl-md border border-line bg-surface text-ink")
            }
          >
            {m.kind === "photo" && (
              <span className="mb-2 block overflow-hidden rounded-xl">
                <Image
                  src={marketPhoto}
                  alt=""
                  aria-hidden
                  className="h-40 w-full object-cover"
                />
              </span>
            )}
            {m.text}
            {m.kind === "ask" && (
              <span className="mt-2.5 flex gap-2">
                {(["swap", "keep"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={choice !== null}
                    onClick={() => setChoice(c)}
                    className={
                      "rounded-full px-4 py-1.5 text-sm font-bold transition active:scale-95 " +
                      (choice === c
                        ? "bg-brand-orange text-[#1A1A1A]"
                        : choice !== null
                          ? "bg-sunken text-faint"
                          : c === "swap"
                            ? "bg-brand-orange text-[#1A1A1A] hover:bg-brand-orange-dark"
                            : "bg-[#FBE7D5] text-ink hover:bg-brand-orange/60")
                    }
                  >
                    {c === "swap" ? st.swap : st.keep}
                  </button>
                ))}
              </span>
            )}
          </motion.div>
        ))}
        {shown > 0 && shown < msgs.length && !reduce && (
          <div className={"flex gap-1 rounded-2xl border border-line bg-surface px-3 py-2 shadow-sm " + (msgs[shown]?.who === "you" ? "self-end" : "self-start")}>
            {[0, 1, 2].map((d) => (
              <motion.span
                key={d}
                className="h-1.5 w-1.5 rounded-full bg-faint"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.6, delay: d * 0.12, repeat: Infinity }}
              />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

/* ── Step 3: receipt + delivery ───────────────────────────────────────── */

function DeliveryScene({
  items,
  active,
  choice,
  reduce,
}: {
  items: DemoItem[];
  active: boolean;
  choice: Choice;
  reduce: boolean;
}) {
  const st = useT().how.stage;
  const lines = items.map((i, idx) => {
    const swapped = idx === 0 && choice === "swap";
    return { ...i, label: swapped ? i.alt.label : i.unit, price: swapped ? i.alt.price : i.price, swapped };
  });
  const spent = lines.reduce((n, l) => n + l.price, 0);
  const held = Math.ceil((spent * 1.15) / 100) * 100;
  const back = held - spent;

  const spentV = useCountUp(spent, active, reduce);
  const backV = useCountUp(back, active, reduce);

  // The ETA ticks down while the rider crosses the map, then holds on "Delivered".
  const [eta, setEta] = useState(reduce ? 0 : 18);
  useEffect(() => {
    if (!active || reduce) {
      setEta(reduce ? 0 : 18);
      return;
    }
    setEta(18);
    let t: ReturnType<typeof setTimeout>;
    const tick = (n: number) => {
      setEta(n);
      t = setTimeout(() => tick(n > 0 ? n - 1 : 18), n > 0 ? 7000 / 18 : 2600);
    };
    t = setTimeout(() => tick(17), 7000 / 18);
    return () => clearTimeout(t);
  }, [active, reduce]);

  return (
    <div className="grid gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-[#EDE7D8]">
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block w-full" role="img" aria-label={`${st.market} to ${st.you}`}>
          {/* basemap: land, then city blocks as buildings */}
          <rect width={MAP_W} height={MAP_H} fill="#EDE7D8" />
          {BLOCKS.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2.5" fill={b.park ? "#CFE0B8" : b.tone ? "#E3DBC7" : "#DCD3BB"} />
          ))}
          {TREES.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5.5" fill="#AFCB8F" />
          ))}
          {/* a few roofs so blocks read as buildings, not blank tiles */}
          {BLOCKS.filter((b) => !b.park && b.w > 30 && b.h > 24).map((b, i) => (
            <g key={i} fill="#CFC3A5" opacity="0.8">
              <rect x={b.x + 6} y={b.y + 6} width={Math.min(18, b.w - 12)} height={Math.min(10, b.h - 12)} rx="2" />
              <rect x={b.x + b.w - 22} y={b.y + b.h - 16} width="16" height="10" rx="2" />
            </g>
          ))}

          {/* roads: paved surface with casing + lane markings, like a real map */}
          <g>
            {ROAD_X.map((x) => (
              <g key={`v${x}`}>
                <rect x={x - ROAD_HALF - 1} y={0} width={ROAD_HALF * 2 + 2} height={MAP_H} fill="#FFFFFF" />
                <rect x={x - ROAD_HALF - 1} y={0} width={ROAD_HALF * 2 + 2} height={MAP_H} fill="none" stroke="#DCD0B4" strokeWidth="1" />
                <line x1={x} y1={0} x2={x} y2={MAP_H} stroke="#E4D9BF" strokeWidth="1.1" strokeDasharray="4 3.5" />
              </g>
            ))}
            {ROAD_Y.map((y) => (
              <g key={`h${y}`}>
                <rect x={0} y={y - ROAD_HALF - 1} width={MAP_W} height={ROAD_HALF * 2 + 2} fill="#FFFFFF" />
                <rect x={0} y={y - ROAD_HALF - 1} width={MAP_W} height={ROAD_HALF * 2 + 2} fill="none" stroke="#DCD0B4" strokeWidth="1" />
                <line x1={0} y1={y} x2={MAP_W} y2={y} stroke="#E4D9BF" strokeWidth="1.1" strokeDasharray="4 3.5" />
              </g>
            ))}
          </g>

          <text x="120" y="36.3" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#A89670" letterSpacing="0.6">PALM AVE</text>
          <text transform="translate(37.7 66) rotate(-90)" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#A89670" letterSpacing="0.6">MARKET RD</text>
          <text x="236" y="140.3" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#A89670" letterSpacing="0.6">MILE 12 WAY</text>

          {/* the route: soft shadow, then the orange line drawing itself */}
          <path d={ROUTE} fill="none" stroke="#D9702F" strokeOpacity="0.22" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <motion.path
            d={ROUTE}
            fill="none"
            stroke="#EE9A5A"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: active ? 1 : reduce ? 1 : 0 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />

          {/* pins */}
          <g transform={`translate(${START.x} ${START.y})`}>
            <ellipse cy="1" rx="5" ry="1.8" fill="#000" opacity="0.15" />
            <path d="M0 0C-6 -8 -8 -12 -8 -16a8 8 0 1 1 16 0c0 4 -2 8 -8 16z" fill="#fff" stroke="#D9702F" strokeWidth="2" />
            <path d="M-3.5 -18.5h7l-.8 4.5h-5.4z M-3 -14h6v3.5h-6z" fill="#D9702F" />
          </g>
          <g transform={`translate(${DOOR.x} ${DOOR.y})`}>
            {!reduce && (
              <circle r="4" fill="#EE9A5A" opacity="0.5">
                <animate attributeName="r" values="4;17" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0" dur="2.2s" repeatCount="indefinite" />
              </circle>
            )}
            <ellipse cy="1" rx="5" ry="1.8" fill="#000" opacity="0.15" />
            <path d="M0 0C-6 -8 -8 -12 -8 -16a8 8 0 1 1 16 0c0 4 -2 8 -8 16z" fill="#EE9A5A" stroke="#fff" strokeWidth="2" />
            <path d="M-4 -16.5l4 -3.5l4 3.5v4.5h-8z" fill="#fff" />
          </g>

          {/* labels */}
          <g fontSize="7" fontWeight="800" fill="#1A1A1A">
            <rect x={START.x + 11} y={START.y - 17} width="30" height="11" rx="5.5" fill="#fff" stroke="#EAD9C4" strokeWidth="0.6" />
            <text x={START.x + 26} y={START.y - 9.5} textAnchor="middle">{st.market}</text>
            <rect x={DOOR.x - 41} y={DOOR.y - 17} width="22" height="11" rx="5.5" fill="#fff" stroke="#EAD9C4" strokeWidth="0.6" />
            <text x={DOOR.x - 30} y={DOOR.y - 9.5} textAnchor="middle">{st.you}</text>
          </g>

          {/* the rider */}
          <g transform={reduce ? `translate(${DOOR.x} ${DOOR.y})` : undefined}>
            <circle r="12" fill="#fff" stroke="#EAD9C4" strokeWidth="1" />
            <image href={riderArt.src} x="-9" y="-9" width="18" height="18" />
            {!reduce && <animateMotion dur="7s" repeatCount="indefinite" path={ROUTE} keyPoints="0;1;1" keyTimes="0;0.92;1" calcMode="linear" />}
          </g>
        </svg>

        {/* ETA, floating on the map like a navigation app */}
        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-display text-sm font-extrabold text-ink shadow-md ring-1 ring-line">
          <span className={"h-2 w-2 rounded-full bg-brand-orange " + (eta > 0 && !reduce ? "animate-pulse" : "")} />
          {eta > 0 ? `${st.eta} ${eta} ${st.min}` : st.arrived}
        </div>

        {/* compass, like a real map app */}
        <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-line">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path d="M12 2 L15 11 L12 9 L9 11 Z" fill="#D9702F" />
            <path d="M12 22 L9 13 L12 15 L15 13 Z" fill="#C7BBA0" />
          </svg>
        </div>

        {/* zoom controls, like a real map app */}
        <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-line">
          <span className="flex h-7 w-7 items-center justify-center text-base font-bold text-ink">+</span>
          <span className="h-px w-full bg-line" />
          <span className="flex h-7 w-7 items-center justify-center text-base font-bold text-ink">−</span>
        </div>
      </div>

      <div className="rounded-2xl border border-line p-3.5">
        <p className="font-display text-sm font-extrabold text-ink">{st.receipt}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-2 text-muted">
              <span className="truncate">
                {l.name}, {l.label}
                {l.swapped && <span className="ml-1 rounded-full bg-[#FBE7D5] px-1.5 py-0.5 text-[0.65rem] font-bold text-ink">↺</span>}
              </span>
              <span className="tabular-nums text-ink">{naira(l.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-line pt-2.5 text-sm">
          <p className="flex justify-between text-muted"><span>{st.held}</span><span className="tabular-nums">{naira(held)}</span></p>
          <p className="flex justify-between font-bold text-ink"><span>{st.spent}</span><span className="tabular-nums">{naira(spentV)}</span></p>
          <p className="flex justify-between rounded-lg bg-brand-green/20 px-2 py-1 font-bold text-ink">
            <span>{st.back}</span><span className="tabular-nums">{naira(backV)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── The whole thing ──────────────────────────────────────────────────── */

export default function HowItWorks() {
  const t = useT();
  const st = t.how.stage;
  const reduce = !!useReducedMotion();

  const [step, setStep] = useState(0);
  const [ids, setIds] = useState<string[]>(["tomatoes", "pepper", "onions"]);
  const [choice, setChoice] = useState<Choice>(null);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });

  const items = ids.map((id) => DEMO.find((d) => d.id === id)).filter((d): d is DemoItem => !!d);

  const running = auto && inView && !hover && !reduce;
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setStep((s) => (s + 1) % 3), STEP_MS);
    return () => clearTimeout(timer);
  }, [running, step]);

  const go = (n: number) => {
    setAuto(false);
    setStep(n);
  };
  const toggle = (id: string) => {
    setAuto(false);
    setChoice(null);
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const pick = (c: Choice) => {
    setAuto(false);
    setChoice(c);
  };

  const needItems = items.length === 0 && step > 0;

  return (
    <div
      ref={ref}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="mt-12 grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10"
    >
      {/* step list */}
      <ol className="space-y-2">
        {t.how.steps.map((s, i) => {
          const on = i === step;
          const done = i < step;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={on ? "step" : undefined}
                className={
                  "relative flex w-full gap-4 overflow-hidden rounded-[1.5rem] border p-4 text-left transition sm:p-5 " +
                  (on ? "border-brand-orange bg-surface shadow-md" : "border-transparent hover:bg-surface/70")
                }
              >
                <span className="flex flex-col items-center">
                  <span
                    className={
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold text-[#1A1A1A] transition-colors " +
                      (on ? "bg-brand-orange" : done ? "bg-brand-orange/40" : "bg-sunken")
                    }
                  >
                    {done ? <Check /> : i + 1}
                  </span>
                  {i < 2 && (
                    <span className="mt-2 w-0.5 flex-1 rounded bg-line">
                      <motion.span
                        className="block w-full origin-top rounded bg-brand-orange"
                        initial={false}
                        animate={{ height: done ? "100%" : "0%" }}
                        transition={{ duration: 0.5 }}
                      />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 pb-1">
                  <span className="block font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{s.title}</span>
                  <span className={"mt-1 block text-muted transition-opacity " + (on ? "opacity-100" : "opacity-70")}>{s.body}</span>
                </span>
                {on && !reduce && (
                  <motion.span
                    key={`${step}-${running}`}
                    aria-hidden
                    className="absolute bottom-0 left-0 h-1 bg-brand-orange/70"
                    initial={{ width: running ? "0%" : "100%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: running ? STEP_MS / 1000 : 0.3, ease: "linear" }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* the stage */}
      <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface p-4 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-orange/10 blur-3xl" />
        <div className="relative mb-4 flex items-center justify-between">
          <span className="rounded-full bg-[#FBE7D5] px-3 py-1 font-display text-xs font-extrabold text-ink">{st.step(step + 1)}</span>
          <span className="text-xs font-semibold text-faint">{st.example}</span>
        </div>

        <div className="relative min-h-[22rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -18 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 && <ListScene items={items} toggle={toggle} />}
              {step > 0 && needItems && (
                <div className="flex min-h-[20rem] flex-col items-center justify-center gap-4 text-center">
                  <p className="max-w-xs text-muted">{st.needItems}</p>
                  <button
                    type="button"
                    onClick={() => go(0)}
                    className="rounded-full bg-brand-orange px-5 py-2 font-display text-sm font-bold text-[#1A1A1A] transition hover:bg-brand-orange-dark active:scale-95"
                  >
                    {st.backToList}
                  </button>
                </div>
              )}
              {step === 1 && !needItems && <ChatScene items={items} active reduce={reduce} choice={choice} setChoice={pick} />}
              {step === 2 && !needItems && <DeliveryScene items={items} active reduce={reduce} choice={choice} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {step === 2 && !needItems && (
          <Link
            href="/shop"
            className="relative mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-brand-orange px-6 font-display font-bold text-[#1A1A1A] shadow-sm transition hover:bg-brand-orange-dark active:scale-[0.98]"
          >
            {st.cta}
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
