"use client";

import EarnPage, { type EarnConfig } from "@/components/marketing/EarnPage";
import riderBike from "@/assets/illustrations/rider-bicycle.webp";
import scooter from "@/assets/illustrations/rider-scooter-basket-1.webp";
import route from "@/assets/illustrations/delivery-map-route.webp";
import handoff from "@/assets/illustrations/order-handoff-vendor-customer.webp";
import phone from "@/assets/illustrations/customer-checking-phone.webp";
import netBag from "@/assets/illustrations/net-bag.webp";
import basket from "@/assets/illustrations/grocery-basket.webp";
import badgeExpress from "@/assets/illustrations/badge-express-delivery.webp";
import badgeHuman from "@/assets/illustrations/badge-human-first-shopping.webp";
import badgeFresh from "@/assets/illustrations/badge-fresh-guarantee.webp";
import earnRiderBikes from "@/assets/illustrations/earn-rider-bikes.webp";
import earnKekeCar from "@/assets/illustrations/earn-keke-car.webp";
import earnPayoutMoment from "@/assets/illustrations/earn-payout-moment.webp";
import agentScene from "@/assets/illustrations/scene-agent-laptop-delivery.webp";

const CFG: EarnConfig = {
  eyebrow: "For riders",
  title: "Deliver market hauls,",
  titleAccent: "earn on your schedule.",
  lede: "Claim a delivery, collect it from the market hub with your code, and ride it to the door. Paid a fixed fee for every completed delivery.",
  cta: "Apply as a rider",
  hero: {
    main: earnRiderBikes,
    alt: "A Qyka rider with a scooter, an e-bike and a car",
    extras: [
      { src: riderBike, cls: "bottom-[6%] left-[2%] w-[30%]" },
      { src: netBag, cls: "right-[4%] top-[10%] w-[15%] rotate-12" },
      { src: basket, cls: "bottom-[8%] right-[4%] w-[24%] -rotate-6" },
    ],
  },
  perks: [
    { title: "Flexible hours", body: "Come online when it suits you and accept the deliveries that fit your route.", art: badgeExpress },
    { title: "A fixed fee per delivery", body: "You know what a delivery pays before you claim it. It counts once the customer confirms they got their order.", art: badgeHuman },
    { title: "Already checked and ready", body: "A shopkeeper at the hub has checked every order against the list. You're moving it, not assembling it.", art: badgeFresh },
  ],
  dayTitle: "A delivery, start to finish.",
  day: [
    { title: "Claim a delivery", body: "Ready orders from your market appear in the app. Claim one - first to claim gets it, and you take one at a time.", art: route },
    { title: "Collect it at the hub", body: "Go to the market hub and show the shopkeeper your 4-digit code. They check it and hand you the order.", art: handoff },
    { title: "Ride it to the door", body: "Bike, keke or car - whatever fits your route. The customer's address and number are in the app.", art: earnKekeCar },
    { title: "Get their code, then earn", body: "Ask the customer for their 4-digit code and enter it to confirm the drop-off. When they confirm receipt, your earnings land.", art: phone },
  ],
  fit: [
    { title: "You know the routes", body: "Market exits, traffic patterns and the fastest way to a doorstep." },
    { title: "You have your own ride", body: "Bike, keke or car: whatever gets an order there intact." },
    { title: "You're phone-fluent", body: "Claiming deliveries, showing your pickup code and entering the customer's code at the door." },
  ],
  requirements: [
    "A smartphone with data, since deliveries, codes and drop-off details live in the app",
    "Your own bike, keke or car in good working order",
    "A bank account or wallet your delivery earnings can be paid into",
    "Valid ID (and a rider's licence, where your vehicle requires one)",
  ],
  faq: [
    { q: "How am I paid?", a: "Earnings are tracked per completed delivery in the app and paid out to your linked account." },
    { q: "Do I deliver across the whole city?", a: "No. You register for an area or market, and only see deliveries starting near you." },
    { q: "What are the codes for?", a: "Your pickup code proves to the shopkeeper that you're the rider who claimed the order. The customer's code, which you ask for at their door, proves you handed it to the right person. Neither can be skipped." },
    { q: "Can I give a delivery back?", a: "Yes, any time before you collect it from the hub - it goes back for other riders. Once you've collected it, it's yours to deliver." },
    { q: "What if I can't find the address?", a: "Drop-off details and the customer's contact are in the app. Chat with them directly if plans change." },
  ],
  form: {
    kind: "rider",
    heading: "Apply as a rider",
    fields: [
      { key: "full_name", label: "Full name", required: true },
      { key: "phone", label: "Phone", required: true, type: "tel" },
      { key: "area", label: "Area you'd cover", required: true },
      { key: "vehicle", label: "Vehicle (bike, keke, car…)" },
    ],
    art: earnPayoutMoment,
  },
  estimator: { pay: "rider", unit: "Deliveries", min: 5, max: 60, start: 25, footnote: "A fixed fee for each completed delivery. Actual earnings depend on the deliveries you complete." },
  other: {
    label: "Know the market? Shop for others",
    href: "/for-agents",
    art: agentScene,
    blurb: "Become an agent and earn on every list you shop.",
  },
};

export default function ForRiders() {
  return <EarnPage cfg={CFG} />;
}
