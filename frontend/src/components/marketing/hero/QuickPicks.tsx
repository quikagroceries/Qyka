"use client";

import Image from "next/image";

import { useT } from "@/lib/locale";
import { QUICK_ITEMS } from "@/components/marketing/hero/quickItems";
import { parseLine, type ListItem } from "@/components/marketing/hero/listHelpers";

export default function QuickPicks({ added, onPick }: { added: ListItem[]; onPick: (line: string) => void }) {
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
