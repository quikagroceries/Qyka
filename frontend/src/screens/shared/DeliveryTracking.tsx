'use client';

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

// Post-payment status screen: a vertical timeline built entirely from the
// order's own timestamps (created_at / agent_assigned_at / paid_at /
// dropped_at_hub_at / hub_received_at / packed_at / rider_claimed_at /
// dispatched_at / delivered_at) - no map, no API key, no "address not
// located" awkwardness. It's honest about what this system actually knows:
// the agent drops the goods at the market hub, the shopkeeper checks them
// in and readies them, a rider claims the job and collects it, then it's
// out for delivery.
const ROWS = [
  { key: "placed", label: "Order placed", ts: (o) => o.created_at },
  { key: "agent_assigned", label: "Agent assigned & accepted", ts: (o) => o.agent_assigned_at },
  { key: "paid", label: "Balance paid", ts: (o) => o.paid_at },
  { key: "at_hub", label: "Dropped at the market hub", ts: (o) => o.dropped_at_hub_at },
  { key: "checked_in", label: "Checked in at the hub", ts: (o) => o.hub_received_at },
  { key: "ready", label: "Ready for a rider", ts: (o) => o.packed_at },
  { key: "rider_assigned", label: "Rider assigned", ts: (o) => o.rider_claimed_at },
  { key: "out_for_delivery", label: "Out for delivery", ts: (o) => o.dispatched_at },
  { key: "delivered", label: "Delivered", ts: (o) => o.delivered_at },
];

// Orders that went out before the hub existed: the agent packed them and a
// courier took them, so they never have the hub or rider timestamps. Show
// them the way they actually happened rather than as a stalled new timeline.
const LEGACY_ROWS = [
  { key: "placed", label: "Order placed", ts: (o) => o.created_at },
  { key: "agent_assigned", label: "Agent assigned & accepted", ts: (o) => o.agent_assigned_at },
  { key: "paid", label: "Balance paid", ts: (o) => o.paid_at },
  { key: "packed", label: "Packed", ts: (o) => o.packed_at },
  { key: "out_for_delivery", label: "Out for delivery", ts: (o) => o.dispatched_at },
  { key: "delivered", label: "Delivered", ts: (o) => o.delivered_at },
];

function rowsFor(order) {
  const legacy = !order.hub_id && (order.status === "packed" || order.dispatched_at || order.delivered_at);
  return legacy ? LEGACY_ROWS : ROWS;
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// The first row with no timestamp yet is "current" - everything before it
// is done (has a timestamp), everything after is still future. Fully
// data-driven, so a stalled/failed step (e.g. packed but dispatch failed)
// correctly parks the timeline there instead of guessing from `status`.
function currentRowIndex(rows, order) {
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].ts(order)) return i;
  }
  return -1;
}

function TimelineRow({ label, timestamp, done, current, isLast, children }: any) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold " +
            (done ? "bg-brand-green text-white" : current ? "bg-brand-orange text-[#1A1A1A]" : "bg-sunken text-faint")
          }
        >
          {done ? <Icon name="check" className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
        </span>
        {/* Solid = already happened, dashed = still ahead - the line
            literally traces the delivery's own route through the steps,
            not just a generic connector. */}
        {!isLast && (
          done ? (
            <div className="my-1 w-0.5 flex-1 rounded-full bg-brand-green" />
          ) : (
            <div className="my-1 flex-1 border-l-2 border-dashed border-[#e8e4df]" />
          )
        )}
      </div>
      <div className={"min-w-0 flex-1 " + (isLast ? "" : "pb-5")}>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className={"font-semibold " + (done || current ? "text-ink" : "text-faint")}>{label}</p>
          {done && <span className="shrink-0 text-xs text-faint">{formatTimestamp(timestamp)}</span>}
          {current && (
            <span className="shrink-0 rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-bold text-brand-orange">
              In progress
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function PhotoRow({ photos, onPreview }: any) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {photos.map((src, idx) => (
        <button key={src + idx} onClick={() => onPreview(src)} className="shrink-0 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary photo */}
          <img src={src} alt="" className="h-16 w-16 object-cover" />
        </button>
      ))}
    </div>
  );
}

function DeliveryTracking({ order, onConfirmDelivery, busy }: any) {
  const [preview, setPreview] = useState<any>(null);
  // Confirming delivery releases the agent's payout - a deliberate two-step
  // tap, not a single button sitting there ready to mis-tap.
  const [confirming, setConfirming] = useState(false);

  const rows = rowsFor(order);
  const currentIdx = currentRowIndex(rows, order);
  const packingPhotos = order.packing_photos || [];
  const riderSaysDelivered = order.status === "out_for_delivery" && !!order.rider_delivered_at;

  return (
    <Card>
      <p className="mb-4 font-bold text-ink">Order status</p>

      <div>
        {rows.map((row, i) => {
          const rawTs = row.ts(order);
          const done = !!rawTs;
          const current = i === currentIdx;
          return (
            <TimelineRow
              key={row.key}
              label={row.label}
              timestamp={rawTs}
              done={done}
              current={current}
              isLast={i === rows.length - 1}
            >
              {row.key === "at_hub" && current && (
                <p className="mt-1 text-sm text-faint">Your agent is taking your order to the hub in the market.</p>
              )}
              {row.key === "at_hub" && done && packingPhotos.length > 0 && (
                <PhotoRow photos={packingPhotos} onPreview={setPreview} />
              )}
              {row.key === "checked_in" && current && order.dropped_at_hub_at && (
                <p className="mt-1 text-sm text-faint">The hub is checking everything arrived.</p>
              )}
              {row.key === "ready" && current && order.hub_received_at && (
                <p className="mt-1 text-sm text-faint">Being bagged up for your rider.</p>
              )}
              {row.key === "rider_assigned" && current && order.packed_at && (
                <p className="mt-1 text-sm text-faint">Waiting for a rider to pick up your order.</p>
              )}
              {row.key === "packed" && done && packingPhotos.length > 0 && (
                <PhotoRow photos={packingPhotos} onPreview={setPreview} />
              )}
            </TimelineRow>
          );
        })}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[1800] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary photo */}
          <img src={preview} alt="Photo of your order" className="max-h-full max-w-full rounded-lg" />
          <button
            onClick={() => setPreview(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <Icon name="close" className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* The PIN the customer gives the rider at their door - the rider's app
          checks it. No longer relevant once delivered. */}
      {order.handover_code && order.status !== "delivered" && order.status !== "closed" && (
        <div className="mt-5 rounded-2xl border border-dashed border-brand-orange/40 bg-brand-orange/[0.08] p-4 text-center">
          <p className="text-sm font-semibold text-muted">Give this code to the rider when they hand you your order</p>
          <p className="mt-1 text-3xl font-extrabold tracking-[0.3em] text-brand-orange">{order.handover_code}</p>
        </div>
      )}

      {/* Only ever appears once the order is actually out for delivery -
          never during packaging, and never a one-tap action, since
          confirming releases the agent's payout. */}
      {riderSaysDelivered && !confirming && (
        <p className="mt-5 rounded-2xl bg-brand-orange/[0.12] px-4 py-3 text-center text-sm font-semibold text-ink">
          Your rider says your order has been handed over. Please confirm below.
        </p>
      )}
      {order.status === "out_for_delivery" && !confirming && (
        <Button onClick={() => setConfirming(true)} fullWidth className="mt-5 text-lg">
          Confirm delivery received
        </Button>
      )}
      {order.status === "out_for_delivery" && confirming && (
        <div className="mt-5 rounded-2xl bg-brand-orange/[0.12] p-4">
          <p className="mb-1 text-sm font-semibold text-ink/80">
            This releases payment to your agent. Confirm you&apos;ve received everything?
          </p>
          {order.handover_code && (
            <p className="mb-3 text-xs text-faint">Your handover code was {order.handover_code} — make sure it matched what the rider gave you.</p>
          )}
          <div className="flex gap-2">
            <Button variant="neutral" onClick={() => setConfirming(false)} disabled={busy} fullWidth>
              Cancel
            </Button>
            <Button onClick={onConfirmDelivery} busy={busy} fullWidth>
              Yes, confirm delivery
            </Button>
          </div>
        </div>
      )}
      {(order.status === "delivered" || order.status === "closed") && (
        <p className="mt-5 rounded-lg bg-brand-green/10 px-3 py-2 text-center text-sm font-semibold text-brand-green">
          Delivered — thanks for shopping with Qyka!
        </p>
      )}
    </Card>
  );
}

export default DeliveryTracking;
