import Link from "next/link";
import Image from "next/image";

import { coverImageForMarket, type Market, type MarketCardStatus } from "@/lib/markets";

const STATUS_PILL: Record<MarketCardStatus, string> = {
  open: "bg-brand-green/15 text-brand-green",
  closed: "bg-sunken text-faint",
  soon: "bg-brand-orange/20 text-brand-orange-dark",
};

// The one market-card shape - used by Home's teaser row and the full Markets
// directory, so "browse markets" doesn't look like two different products
// depending which page you land on. rounded-[2rem]/bg-canvas to match the
// rest of the marketing site's card language (see MarketingCard.tsx).
export default function MarketCard({
  market,
  status,
  statusLabel,
  venueLabel,
  timeLabel,
  actionLabel,
  showCategories = false,
}: {
  market: Market;
  status: MarketCardStatus;
  statusLabel: string;
  venueLabel: string;
  timeLabel?: string;
  actionLabel: string;
  showCategories?: boolean;
}) {
  const href = status === "open" ? `/shop?market=${market.slug}` : `/markets/${market.slug}`;

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-line bg-canvas transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="relative h-48 overflow-hidden">
        <Image
          src={coverImageForMarket(market)}
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
          <h3 className="font-display text-xl font-extrabold">{market.name}</h3>
          <span className={"shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold " + STATUS_PILL[status]}>
            {status === "open" && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-green align-middle" />}
            {statusLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-faint">
          {market.city} · {venueLabel}
          {timeLabel && <> · {timeLabel}</>}
        </p>
        <p className="mt-2 line-clamp-2 text-muted">{market.description}</p>
        {showCategories && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {market.categories.map((cat) => (
              <span key={cat} className="rounded-full bg-canvas-deep px-2.5 py-1 text-xs font-semibold capitalize text-muted">
                {cat}
              </span>
            ))}
          </div>
        )}
        <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-orange/15 px-4 py-2 font-display text-sm font-bold text-brand-orange-dark transition group-hover:bg-brand-orange group-hover:text-[#1A1A1A]">
          {/* callers' i18n strings carry a trailing "→" of their own (see
              content/i18n.ts `markets.startHere` etc.) - stripped here so it
              doesn't double up with the arrow icon below. */}
          {actionLabel.replace(/\s*→\s*$/, "")}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
