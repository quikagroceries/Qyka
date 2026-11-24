"use client";

import EarnPage, { type EarnConfig } from "@/components/marketing/EarnPage";
import earnAgentEarning from "@/assets/illustrations/earn-agent-earning.webp";
import earnPayoutMoment from "@/assets/illustrations/earn-payout-moment.webp";
import conversation from "@/assets/illustrations/agent-customer-conversation.webp";
import scale from "@/assets/illustrations/vendor-weighing-scale.webp";
import phoneList from "@/assets/illustrations/phone-shopping-list.webp";
import handoff from "@/assets/illustrations/order-handoff-vendor-customer.webp";
import tomatoes from "@/assets/illustrations/tomatoes.webp";
import garlic from "@/assets/illustrations/garlic.webp";
import crate from "@/assets/illustrations/produce-crate.webp";
import badgeHuman from "@/assets/illustrations/badge-human-first-shopping.webp";
import badgeLive from "@/assets/illustrations/badge-real-time-updates.webp";
import badgeFresh from "@/assets/illustrations/badge-fresh-guarantee.webp";
import riderBike from "@/assets/illustrations/rider-bicycle.webp";

const CFG: EarnConfig = {
  eyebrow: "For agents",
  title: "Earn shopping a market",
  titleAccent: "you already know.",
  lede: "Customers send lists. You bargain the stalls, pay by transfer with photo proof, drop the haul at the market hub, and get paid when it reaches the customer.",
  cta: "Apply as an agent",
  hero: {
    main: earnAgentEarning,
    alt: "An agent checking her Qyka earnings on her phone",
    extras: [
      { src: tomatoes, cls: "left-[2%] top-[26%] w-[15%] -rotate-12" },
      { src: garlic, cls: "right-[3%] top-[10%] w-[13%] rotate-12" },
      { src: crate, cls: "bottom-[8%] right-[6%] w-[26%] rotate-6" },
    ],
  },
  perks: [
    { title: "Your hours", body: "Only see and accept runs for the markets you registered for.", art: badgeHuman },
    { title: "Paid per completed run", body: "You earn when your customer confirms their order arrived. Earnings are tracked in the app and paid to your linked account.", art: badgeLive },
    { title: "No cash out of pocket", body: "You shop with transfer float authorised for that run.", art: badgeFresh },
  ],
  dayTitle: "A run, start to finish.",
  day: [
    { title: "Accept a run", body: "A customer list lands for your market. You accept only what you can shop well.", art: phoneList },
    { title: "Bargain the stalls", body: "Shop the way you already do: weight, freshness, fair price.", art: scale },
    { title: "Transfer and prove", body: "Pay vendors by transfer and snap photo proof. No unauthorised cash.", art: conversation },
    { title: "Drop it at the hub", body: "Once the customer has paid, take the haul to the hub in your market. The shopkeeper checks it against the list and a rider takes it from there. You're done.", art: handoff },
  ],
  fit: [
    { title: "You know the market", body: "Stalls, seasons and who sells what, not a warehouse aisle." },
    { title: "You're phone-fluent", body: "Transfers, photos and chat while you move through the market." },
    { title: "You keep it clean", body: "No side cash. Proof on every spend, and a check-in at the hub. Customers trust the trail." },
  ],
  requirements: [
    "A smartphone with data, for chat, photos and transfers on the run",
    "A bank account or wallet the run's transfer float can move through",
    "A specific market you already shop and know the stalls at",
    "Valid ID for verification before your first run",
  ],
  faq: [
    { q: "Do I shop with my own money?", a: "No. You shop using transfer float authorised for that run, never your own cash upfront." },
    { q: "How am I paid?", a: "Earnings are tracked per completed run in the app and paid out to your linked account. A run counts once the customer confirms their order arrived." },
    { q: "Do I deliver the order myself?", a: "No. After shopping, you drop the haul at the market hub. The shopkeeper there checks it in and a Qyka rider delivers it." },
    { q: "Can I pick which runs I take?", a: "Yes. You only see and accept orders for the market(s) you've registered for." },
  ],
  form: {
    kind: "agent",
    heading: "Apply as an agent",
    fields: [
      { key: "full_name", label: "Full name", required: true },
      { key: "phone", label: "Phone", required: true, type: "tel" },
      { key: "market_id", label: "Market you know best", required: true, type: "market" },
    ],
    art: earnPayoutMoment,
  },
  estimator: { pay: "agent", unit: "Orders", min: 5, max: 30, start: 15, footnote: "That's the base pay for a normal shop; long shops pay a little more. Actual earnings depend on the runs you complete." },
  other: {
    label: "Got wheels instead? Deliver with Qyka",
    href: "/for-riders",
    art: riderBike,
    blurb: "Collect orders from a market hub and ride them to the customer's door.",
  },
};

export default function ForAgents() {
  return <EarnPage cfg={CFG} />;
}
