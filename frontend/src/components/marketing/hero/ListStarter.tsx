"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { saveGuestDraft } from "@/lib/guestDraft";
import { useT } from "@/lib/locale";
import { ADD_ITEM_EVENT, useTypedPlaceholder } from "@/components/marketing/anim";
import QuickPicks from "@/components/marketing/hero/QuickPicks";
import { formatItem, unitFor, type ListItem } from "@/components/marketing/hero/listHelpers";
import { parseLine } from "@/components/marketing/hero/listHelpers";

export default function ListStarter({ id }: { id: string }) {
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
        const { buildDraft } = await import("@/components/order/ListBuilder");
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
