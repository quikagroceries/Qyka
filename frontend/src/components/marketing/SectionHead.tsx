import type { ReactNode } from "react";

import Eyebrow from "@/components/marketing/Eyebrow";
import { Reveal } from "@/components/marketing/motion";

// Shared section head: the hero's pill eyebrow + display headline whose
// closing word is picked out in burnt peach, so every section opens the same
// way the hero does.
function splitTitle(title: string) {
  const w = title.trim().split(" ");
  const last = w.pop();
  return { lead: w.join(" "), last };
}

export function SectionHeadInline({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { lead, last } = splitTitle(title);
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 font-display text-[clamp(2.1rem,4.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-balance text-ink">
        {lead} <span className="text-brand-orange-dark">{last}</span>
      </h2>
    </>
  );
}

export default function SectionHead({
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
  children?: ReactNode;
}) {
  const { lead, last } = splitTitle(title);
  const center = align === "center";
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 font-display text-[clamp(2.1rem,4.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-balance text-ink">
        {lead} <span className="text-brand-orange-dark">{last}</span>
      </h2>
      {sub && <p className={"mt-3 text-lg text-muted " + (center ? "mx-auto max-w-xl" : "")}>{sub}</p>}
      {children}
    </Reveal>
  );
}
