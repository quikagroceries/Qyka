"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import Card from "@/components/ui/Card";
import HeroBanner from "@/components/layout/HeroBanner";
import Notifications from "@/screens/shared/Notifications";
import SectionHeader from "@/components/ui/SectionHeader";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import hubArt from "@/assets/illustrations/map-pin-storefront.webp";
import emptyArt from "@/assets/illustrations/produce-crate.webp";
import { ago, errMsg, shortId } from "@/lib/hubUtils";

// The queue is three lanes in the order work actually happens at the hub:
// check what the agent brought, bag it, hand it to the rider who comes.
const LANES = [
  {
    status: "dropped_at_hub",
    icon: "basket",
    title: "Just dropped",
    subtitle: "Check what the agent brought against the list.",
    hint: "Check in",
  },
  {
    status: "received_by_hub",
    icon: "check",
    title: "Checked in",
    subtitle: "Bag it up and mark it ready for a rider.",
    hint: "Mark ready",
  },
  {
    status: "ready_for_pickup",
    icon: "bike",
    title: "Ready for riders",
    subtitle: "A rider will show you a code when they arrive.",
    hint: "Waiting for a rider",
  },
];

function OrderCard({ order, hint, onOpen }: any) {
  const waiting = order.rider_waiting;
  const n = order.items.length;
  return (
    <Card
      interactive
      onClick={onOpen}
      className={"border-2 " + (waiting ? "border-brand-orange" : "border-line")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-extrabold tracking-wide text-ink">#{shortId(order.id)}</span>
        <span className="text-xs text-faint">
          {order.hub_received_at ? `Checked in ${ago(order.hub_received_at)}` : `Dropped ${ago(order.dropped_at_hub_at)}`}
        </span>
      </div>
      <p className="mt-2 text-muted">
        {n} item{n === 1 ? "" : "s"}
        {order.agent_name ? ` · from ${order.agent_name}` : ""}
      </p>
      <p className={"mt-3 text-sm font-bold " + (waiting ? "text-brand-orange-dark" : "text-ink/70")}>
        {waiting ? `${order.rider_name || "A rider"} is here — enter their code` : hint}
      </p>
    </Card>
  );
}

export default function HubHome() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[] | null>(null);
  const [hub, setHub] = useState<any>(null);
  const [error, setError] = useState("");

  usePolling(
    async () => {
      try {
        const [list, h] = await Promise.all([api.getHubOrders(), hub ? Promise.resolve(hub) : api.getMyHub()]);
        setOrders(list);
        setHub(h);
        setError("");
      } catch (e) {
        setError("Could not load the hub. " + errMsg(e));
      }
    },
    15_000,
  );

  const byStatus = (s: string) => (orders || []).filter((o) => o.status === s);
  const toCheckIn = byStatus("dropped_at_hub").length;
  const riderWaiting = (orders || []).filter((o) => o.rider_waiting).length;

  let title = "Your hub";
  let body = "Orders agents drop off show up here.";
  if (orders) {
    if (riderWaiting > 0) {
      title = `${riderWaiting} rider${riderWaiting === 1 ? " is" : "s are"} waiting.`;
      body = "Open the order and enter the code they show you.";
    } else if (toCheckIn > 0) {
      title = `${toCheckIn} to check in.`;
      body = "An agent has dropped goods off — check them against the list.";
    } else if (orders.length > 0) {
      title = "Nothing needs you right now.";
      body = "Everything here is checked in and waiting for a rider.";
    } else {
      title = "All clear.";
    }
  }

  return (
    <div>
      {/* "An agent has dropped an order at your hub" arrives as a toast too,
          so it's seen even when the queue below has scrolled out of view. */}
      <Notifications />
      <HeroBanner
        eyebrow={hub?.name || "Hub"}
        live={riderWaiting > 0 || toCheckIn > 0}
        title={title}
        body={body}
        illustration={hubArt}
        illustrationAlt="Market hub"
      />

      {error && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {orders === null && !error && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {orders && orders.length === 0 && (
        <EmptyState
          image={emptyArt}
          title="No orders at your hub"
          subtitle="When an agent drops an order off, it lands here and you'll get a notification."
        />
      )}

      {orders &&
        LANES.map((lane) => {
          const list = byStatus(lane.status);
          if (list.length === 0) return null;
          // Riders who are already standing there go first.
          const sorted = [...list].sort((a, b) => Number(b.rider_waiting) - Number(a.rider_waiting));
          return (
            <div key={lane.status} className="mb-8">
              <SectionHeader icon={lane.icon} title={lane.title} subtitle={lane.subtitle} className="mb-3" />
              <div className="grid gap-3 sm:grid-cols-2">
                {sorted.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    hint={lane.hint}
                    onOpen={() => router.push(`/shopkeeper/orders/${o.id}`)}
                  />
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
