"use client";

import { useState, type FormEvent } from "react";
import { notifyMeMailto } from "@/lib/contact";
import { MarketingButton } from "@/components/marketing/MarketingButton";

// The "this market isn't live yet, email me when it is" form - used on the
// market detail page. Opens the visitor's own mail app via mailto rather
// than posting anywhere, same as the other waitlist touchpoints (see
// notifyMeMailto in lib/contact.ts).
export default function NotifyMarketForm({ marketLabel }: { marketLabel: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    window.location.href = notifyMeMailto(marketLabel, email);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="max-w-sm text-sm font-semibold text-brand-green">
        Opening your mail app — we&apos;ll note you for {marketLabel}.
      </p>
    );
  }

  return (
    <form className="max-w-sm w-full flex flex-col gap-3" onSubmit={onSubmit}>
      <label className="text-sm font-semibold text-ink">Join the waitlist for {marketLabel}</label>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          className="flex-1 h-[50px] rounded-full px-5 border border-line bg-surface text-ink focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
          required
        />
        <MarketingButton type="submit" className="min-h-[50px]">Join</MarketingButton>
      </div>
    </form>
  );
}
