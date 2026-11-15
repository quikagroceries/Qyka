import type { HTMLAttributes } from "react";

// The marketing site's card shape - rounded-[2rem] (32px), matching the
// market cards on Home/MarketsSection, not the app's rounded-3xl (24px)
// Card.tsx. Same bg-surface/border-line/shadow-sm base either way, just the
// bigger, softer radius the marketing site has used everywhere since the
// Home redesign.
function MarketingCard({
  interactive = false,
  className = "",
  children,
  ...props
}: { interactive?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "rounded-[2rem] border border-line bg-surface shadow-sm p-5",
        interactive ? "transition hover:-translate-y-0.5 hover:shadow-md" : "",
        className,
      ].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export default MarketingCard;
