"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import SectionHeader from "@/components/ui/SectionHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import HeroBanner from "@/components/layout/HeroBanner";
import OtpInput from "@/components/auth/OtpInput";
import { CardSkeleton } from "@/components/ui/Skeleton";
import handoffArt from "@/assets/illustrations/order-handoff-vendor-customer.webp";
import { ago, errMsg, shortId } from "./hubUtils";

// One order, one job at a time: which panel shows is decided by where the
// order is in the hub's own custody chain, so the shopkeeper only ever sees
// the one thing they can do next.

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
    >
      <span aria-hidden>←</span> Back to hub
    </button>
  );
}

function PhotoStrip({ photos, onAdd, uploading, canAdd }: any) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((src: string, i: number) => (
        // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary thumbnails
        <img key={src + i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
      ))}
      {canAdd && (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-strong text-faint disabled:opacity-50"
          >
            <Icon name="camera" className="h-5 w-5" />
            <span className="text-[10px] font-semibold">{uploading ? "…" : "Add"}</span>
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onAdd(file);
            }}
          />
        </>
      )}
    </div>
  );
}

export default function HubOrder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Check-in form
  const [seen, setSeen] = useState<Set<string> | null>(null); // null until the first load seeds "everything arrived"
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // Handover
  const [code, setCode] = useState("");
  const [handedTo, setHandedTo] = useState<string | null>(null);

  usePolling(
    async () => {
      try {
        const o = await api.getHubOrder(orderId);
        setOrder(o);
        setSeen((cur) => cur ?? new Set(o.items.map((i: any) => i.id)));
        setLoadError("");
      } catch (e) {
        setLoadError(errMsg(e));
      }
    },
    10_000,
    [orderId],
  );

  const back = () => router.push("/shopkeeper");

  async function run(fn: () => Promise<any>, onDone?: (o: any) => void) {
    setError("");
    setBusy(true);
    try {
      const o = await fn();
      setOrder(o);
      onDone?.(o);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(file: File) {
    setError("");
    setUploading(true);
    try {
      const url = await api.uploadHubPhoto(file);
      setPhotos((cur) => [...cur, url]);
    } catch (e) {
      setError("Photo upload failed. " + errMsg(e));
    } finally {
      setUploading(false);
    }
  }

  if (loadError && !order) {
    return (
      <div>
        <BackButton onClick={back} />
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</p>
      </div>
    );
  }
  if (!order || !seen) {
    return (
      <div>
        <BackButton onClick={back} />
        <CardSkeleton />
      </div>
    );
  }

  const items: any[] = order.items;
  const missing = items.filter((i) => !seen.has(i.id));
  const status = order.status;

  const header = (title: string, body: string) => (
    <>
      <BackButton onClick={back} />
      <HeroBanner
        compact
        badge={<StatusBadge status={status} />}
        title={title}
        body={body}
        illustration={handoffArt}
        illustrationAlt="Order handover"
      />
    </>
  );

  // ── Dropped: check what arrived against the list ────────────────────────
  if (status === "dropped_at_hub") {
    const needsNote = missing.length > 0 && !note.trim();
    return (
      <div>
        {header(
          `Check in #${shortId(order.id)}`,
          `${order.agent_name || "The agent"} dropped this ${ago(order.dropped_at_hub_at)}. Tick what you can see in the bag.`,
        )}
        <Card className="mb-4">
          <SectionHeader icon="basket" title="What's in the bag" className="mb-3" />
          <ul className="divide-y divide-line">
            {items.map((it) => {
              const on = seen.has(it.id);
              return (
                <li key={it.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setSeen((cur) => {
                          const next = new Set(cur);
                          if (on) next.delete(it.id);
                          else next.add(it.id);
                          return next;
                        })
                      }
                      className="h-5 w-5 shrink-0 accent-brand-orange"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={"block font-semibold " + (on ? "text-ink" : "text-red-600")}>
                        {it.quantity ? `${it.quantity} × ` : ""}
                        {it.description}
                      </span>
                      {it.requested_note && <span className="block text-sm text-muted">{it.requested_note}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>

        {missing.length > 0 && (
          <Card className="mb-4 !bg-brand-orange/10 !border-brand-orange/30">
            <p className="mb-2 font-semibold text-ink">
              {missing.length} item{missing.length === 1 ? "" : "s"} not in the bag
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="What's missing, and anything the agent told you"
              className="w-full rounded-2xl border border-line bg-surface p-3 text-base outline-none focus:border-brand-orange"
            />
            <p className="mt-1 text-xs text-muted">
              You can still check it in — this note is kept on the order.
            </p>
          </Card>
        )}

        <Card className="mb-4">
          <SectionHeader icon="camera" title="Photo of the goods" subtitle="Optional, but it protects you." className="mb-3" />
          <PhotoStrip photos={photos} onAdd={addPhoto} uploading={uploading} canAdd />
        </Card>

        {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        <Button
          fullWidth
          busy={busy}
          disabled={needsNote || uploading}
          className="text-lg"
          onClick={() =>
            run(() =>
              api.receiveHubOrder(order.id, {
                received_item_ids: missing.length > 0 ? [...seen] : undefined,
                note: note.trim() || undefined,
                photos,
              }),
            )
          }
        >
          {missing.length > 0 ? `Check in with ${missing.length} missing` : "Everything's here — check in"}
        </Button>
        {needsNote && <p className="mt-2 text-center text-sm text-muted">Add a note about what&apos;s missing first.</p>}
      </div>
    );
  }

  // ── Received: bag it and mark ready ─────────────────────────────────────
  if (status === "received_by_hub") {
    const flagged = new Set<string>(order.hub_missing_item_ids);
    return (
      <div>
        {header(`#${shortId(order.id)} is checked in`, "Bag it up so it's ready the moment a rider arrives.")}
        <Card className="mb-4">
          <SectionHeader icon="check" title="Checked in" className="mb-3" />
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 py-3">
                <span className={"font-semibold " + (flagged.has(it.id) ? "text-red-600" : "text-ink")}>
                  {it.quantity ? `${it.quantity} × ` : ""}
                  {it.description}
                </span>
                {flagged.has(it.id) && <span className="text-xs font-bold text-red-600">Missing</span>}
              </li>
            ))}
          </ul>
          {order.hub_receipt_note && <p className="mt-3 rounded-2xl bg-sunken p-3 text-sm text-muted">{order.hub_receipt_note}</p>}
        </Card>
        {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        <Button fullWidth busy={busy} className="text-lg" onClick={() => run(() => api.markHubOrderReady(order.id))}>
          Ready for a rider
        </Button>
      </div>
    );
  }

  // ── Ready: wait for a rider, then release with their code ───────────────
  if (status === "ready_for_pickup") {
    return (
      <div>
        {header(
          order.rider_waiting ? `${order.rider_name || "A rider"} is here` : `#${shortId(order.id)} is ready`,
          order.rider_waiting
            ? "Ask them for the 4-digit code on their phone, and enter it to hand the order over."
            : "No rider has claimed it yet. This page updates by itself when one does.",
        )}
        {order.rider_waiting ? (
          <Card className="mb-4 border-2 border-brand-orange text-center">
            <p className="mb-4 font-semibold text-ink">Rider&apos;s code</p>
            <div className="mb-4 flex justify-center">
              <OtpInput value={code} onChange={setCode} length={4} autoFocus />
            </div>
            {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
            <Button
              fullWidth
              busy={busy}
              disabled={code.length < 4}
              className="text-lg"
              onClick={() =>
                run(
                  () => api.handoverHubOrder(order.id, code),
                  () => setHandedTo(order.rider_name || "the rider"),
                )
              }
            >
              Hand over to rider
            </Button>
            <p className="mt-3 text-xs text-muted">Only hand the bag over once the code matches.</p>
          </Card>
        ) : (
          <Card className="mb-4 text-center">
            <p className="text-muted">Waiting for a rider to claim this order…</p>
          </Card>
        )}
        <Card>
          <SectionHeader icon="basket" title="In the bag" className="mb-3" />
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className="py-3 font-semibold text-ink">
                {it.quantity ? `${it.quantity} × ` : ""}
                {it.description}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  // ── Gone: handed over (this session, or reopened from a link) ───────────
  return (
    <div>
      {header(
        handedTo ? `Handed to ${handedTo}` : `#${shortId(order.id)} has left the hub`,
        "It's out for delivery. Your fee is added to your earnings once the customer confirms they received it.",
      )}
      <Button fullWidth onClick={back} className="text-lg">
        Back to hub
      </Button>
    </div>
  );
}
