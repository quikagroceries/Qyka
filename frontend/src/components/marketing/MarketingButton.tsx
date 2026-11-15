import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

// The marketing site's one button shape: a pill, not the app's rounded-2xl
// Button.tsx - this is the shared CTA used across Home/EarnPage/sections, so
// Markets/Pricing/Help stop reinventing their own `rounded-2xl` buttons and
// line up with the rest of the marketing site instead.
const BASE =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 font-display text-base font-bold transition active:scale-[0.98]";

const VARIANTS = {
  primary: "bg-brand-orange text-[#1A1A1A] shadow-sm hover:bg-brand-orange-dark hover:shadow-md",
  neutral: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  outline: "border border-line bg-white text-ink shadow-sm hover:border-brand-orange hover:bg-[#FBE7D5]",
};

type Variant = keyof typeof VARIANTS;

function cls(variant: Variant, className: string) {
  return [BASE, VARIANTS[variant], className].filter(Boolean).join(" ");
}

export function MarketingButton({
  variant = "primary",
  className = "",
  ...props
}: { variant?: Variant; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cls(variant, className)} {...props} />;
}

export function MarketingLinkButton({
  variant = "primary",
  className = "",
  href,
  children,
  ...props
}: { variant?: Variant; className?: string; href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link href={href} className={cls(variant, className)} {...props}>
      {children}
    </Link>
  );
}
