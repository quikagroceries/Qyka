"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { ago, errMsg, shortId } from "@/lib/hubUtils";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import EmptyState from "@/components/ui/EmptyState";
import HeroBanner from "@/components/layout/HeroBanner";
import OtpInput from "@/components/auth/OtpInput";
import { CardSkeleton } from "@/components/ui/Skeleton";
import riderArt from "@/assets/illustrations/char-rider-scooter.webp";
import routeArt from "@/assets/illustrations/delivery-map-route.webp";
import emptyArt from "@/assets/illustrations/rider-scooter-basket-1.webp";

// A rider does one job at a time (the backend enforces it), so this screen is
// either "the one job you're on" or "the pool of jobs you can take" - never
// both. The job moves through three states, and the screen follows it:
//   ready_for_pickup  -> go to the hub, show the shopkeeper your code
//   out_for_delivery  -> take it to the customer, enter THEIR code at the door
//   (delivered, waiting for the customer to confirm)

const mapsUrl = (job: any) =>
  job.dropoff_latitude != null && job.dropoff_longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${job.dropoff_latitude},${job.dropoff_longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.delivery_address || "")}`;

function PickupCard({ job, onRelease, busy, error }: any) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Card className="mb-4 border-2 border-brand-orange text-center">
        <p className="text-sm font-semibold text-muted">Show this code to the shopkeeper</p>
        <p className="my-3 font-display text-5xl font-extrabold tracking-[0.35em] text-brand-orange-dark">
          {job.pickup_code}
        </p>
        <p className="text-sm text-muted">
          They enter it to hand you the order. Don&apos;t share it with anyone else.
        </p>
      </Card>

      <Card className="mb-4">
        <SectionHeader icon="store" title={job.hub_name || "The hub"} subtitle={job.market_name || undefined} className="mb-3" />
        <p className="text-muted">
          {job.item_count} item{job.item_count === 1 ? "" : "s"} to collect
        </p>
        {job.delivery_address && (
          <p className="mt-2 text-sm text-muted">
            Then deliver to <span className="font-semibold text-ink">{job.delivery_address}</span>
          </p>
        )}
      </Card>

      {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {!confirming ? (
        <Button variant="neutral" fullWidth onClick={() => setConfirming(true)}>
          Can&apos;t do this one — give it back
        </Button>
      ) : (
        <Card className="!bg-brand-orange/10">
          <p className="mb-3 text-sm font-semibold text-ink">
            This puts the job back for other riders. Give it back?
          </p>
          <div className="flex gap-2">
            <Button variant="neutral" fullWidth onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
            <Button fullWidth busy={busy} onClick={onRelease}>
              Give it back
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}

function DeliverCard({ job, onDeliver, busy, error }: any) {
  const [code, setCode] = useState("");
  return (
    <>
      <Card className="mb-4">
        <SectionHeader icon="pin" title={job.customer_name || "Customer"} subtitle="Deliver to" className="mb-3" />
        <p className="font-semibold text-ink">{job.delivery_address || "No address on this order"}</p>
        <div className="mt-4 flex gap-2">
          {job.customer_phone && (
            <a
              href={`tel:${job.customer_phone}`}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-sunken px-5 font-semibold text-ink hover:bg-sunken-2"
            >
              Call
            </a>
          )}
          <a
            href={mapsUrl(job)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-sunken px-5 font-semibold text-ink hover:bg-sunken-2"
          >
            Directions
          </a>
        </div>
      </Card>

      <Card className="border-2 border-brand-orange text-center">
        <p className="mb-1 font-semibold text-ink">Customer&apos;s code</p>
        <p className="mb-4 text-sm text-muted">Ask for the 4-digit code on their phone before you hand anything over.</p>
        <div className="mb-4 flex justify-center">
          <OtpInput value={code} onChange={setCode} length={4} />
        </div>
        {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        <Button fullWidth busy={busy} disabled={code.length < 4} className="text-lg" onClick={() => onDeliver(code)}>
          Confirm drop-off
        </Button>
      </Card>
    </>
  );
}

function PoolCard({ job, onClaim, busy }: any) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-extrabold text-ink">{job.hub_name || "Market hub"}</p>
          <p className="text-sm text-muted">{job.market_name}</p>
        </div>
        <span className="shrink-0 text-xs text-faint">Ready {ago(job.ready_at)}</span>
      </div>
      <p className="mt-3 text-muted">
        {job.item_count} item{job.item_count === 1 ? "" : "s"} · #{shortId(job.id)}
      </p>
      <Button fullWidth busy={busy} className="mt-4" onClick={() => onClaim(job.id)}>
        Claim this job
      </Button>
    </Card>
  );
}

export default function RiderJobs() {
  const [mine, setMine] = useState<any[] | null>(null);
  const [pool, setPool] = useState<any[] | null>(null);
  const [fatal, setFatal] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const m = await api.getMyRiderJobs();
      setMine(m);
      // The pool only matters when there's no job in hand.
      setPool(m.length === 0 ? await api.getRiderJobs() : []);
      setFatal("");
    } catch (e) {
      const msg = errMsg(e);
      // No roster record / suspended: nothing else on this screen will work.
      if (String((e as any)?.message).startsWith("403")) setFatal(msg);
      else setFatal("Could not load jobs. " + msg);
    }
  }
  usePolling(load, 10_000);

  async function act(fn: () => Promise<any>) {
    setError("");
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const job = mine && mine.length > 0 ? mine[0] : null;
  const delivering = job?.status === "out_for_delivery";
  const handedOver = delivering && !!job.delivered_at;

  let eyebrow = "Jobs";
  let title = "Loading jobs…";
  let body = "";
  let art = riderArt;
  if (mine !== null && pool !== null) {
    if (!job) {
      eyebrow = "Ready to ride";
      title = pool.length > 0 ? `${pool.length} job${pool.length === 1 ? "" : "s"} waiting.` : "No jobs right now.";
      body = pool.length > 0 ? "Claim one to get started. It's yours until you deliver it." : "New orders show up here the moment a hub has one ready.";
    } else if (handedOver) {
      eyebrow = `Order #${shortId(job.id)}`;
      title = "Handed over.";
      body = "Waiting for the customer to confirm. Your fee lands once they do.";
      art = routeArt;
    } else if (delivering) {
      eyebrow = `Order #${shortId(job.id)}`;
      title = `Deliver to ${job.customer_name || "the customer"}.`;
      body = "Collected from the hub. Take it to the door and get the customer's code.";
      art = routeArt;
    } else {
      eyebrow = `Order #${shortId(job.id)}`;
      title = `Go to ${job.hub_name || "the hub"}.`;
      body = "Show the shopkeeper your code and they'll hand you the order.";
    }
  }

  return (
    <div>
      <HeroBanner
        eyebrow={eyebrow}
        live={!!job && !handedOver}
        title={title}
        body={body}
        illustration={art}
        illustrationAlt="Rider"
      />

      {fatal && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{fatal}</p>}
      {!fatal && (mine === null || pool === null) && <CardSkeleton />}

      {!fatal && job && !delivering && (
        <PickupCard job={job} busy={busy} error={error} onRelease={() => act(() => api.releaseRiderJob(job.id))} />
      )}
      {!fatal && job && delivering && !handedOver && (
        <DeliverCard job={job} busy={busy} error={error} onDeliver={(code: string) => act(() => api.deliverRiderJob(job.id, code))} />
      )}
      {!fatal && handedOver && (
        <Card className="text-center">
          <p className="font-semibold text-brand-green">Drop-off confirmed</p>
          <p className="mt-1 text-sm text-muted">You&apos;ll be able to take a new job as soon as the customer confirms.</p>
        </Card>
      )}

      {!fatal && !job && pool !== null && pool.length === 0 && mine !== null && (
        <EmptyState image={emptyArt} title="Nothing to collect yet" subtitle="This page checks for new jobs by itself." />
      )}
      {!fatal && !job && pool !== null && pool.length > 0 && (
        <>
          {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <SectionHeader icon="bike" title="Available jobs" subtitle="First to claim gets it." className="mb-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            {pool.map((j) => (
              <PoolCard key={j.id} job={j} busy={busy} onClaim={(id: string) => act(() => api.claimRiderJob(id))} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
