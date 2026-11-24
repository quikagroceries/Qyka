'use client';

import StatTile from "@/components/ui/StatTile";
import FilterPills from "@/components/ui/FilterPills";
import { usePageSearch } from "@/components/layout/PageSearchContext";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { CardSkeleton } from "@/components/ui/Skeleton";
import Input from "@/components/ui/Input";
import OrderInterventions from "@/components/admin/OrderInterventions";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatAge } from "@/lib/adminUtils";
import { marketTone, TONE_COVER } from "@/lib/vendorVisuals";
import { coverImageForMarket } from "@/lib/markets";
import { summarizeOrderStatus } from "@/lib/orderStatus";
import { usePolling } from "@/lib/usePolling";

// An overview, not a live feed; paused while the tab is hidden (usePolling).
const POLL_MS = 15000;

// Mirrors admin/service.py::admin_cancel_order's own guard exactly - a rider
// already out with the goods (DELIVERED) is past the point of a clean cancel.
const ADMIN_CANCELLABLE = new Set([
  "draft", "proposed", "agent_assigned", "shopping",
  "awaiting_payment", "paid", "dropped_at_hub", "received_by_hub", "ready_for_pickup", "packed", "out_for_delivery",
]);

export function OrderDetailPanel({ orderId, markets, agents, onBack, onAssigned }: any) {
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickedAgent, setPickedAgent] = useState("");
  // Who the hub and rider actually are (the order only carries ids).
  const [hubs, setHubs] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [releasing, setReleasing] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [releaseError, setReleaseError] = useState("");

  const [cancelling, setCancelling] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelled, setCancelled] = useState(false);

  const [raisingCap, setRaisingCap] = useState(false);
  const [capExtra, setCapExtra] = useState("");
  const [capBusy, setCapBusy] = useState(false);
  const [capError, setCapError] = useState("");
  const [capResult, setCapResult] = useState<any>(null);

  async function refresh() {
    try {
      const o = await api.getOrder(orderId);
      setOrder(o);
      const suggestion = o.paid_at ? o.grand_total : o.deposit_paid_at ? o.deposit_amount : "0.00";
      setRefundAmount((prev) => prev || String(suggestion));
      if (o.hub_id || o.rider_id) {
        // Names only - the order is already on screen, so a failure here is not worth an error.
        api.listHubs().then(setHubs).catch(() => {});
        api.listRiders().then(setRiders).catch(() => {});
      }
    } catch (e) {
      setError("Could not load this order. (" + e.message + ")");
    }
  }

  async function handleReleaseRider() {
    setReleaseBusy(true); setReleaseError("");
    try {
      await api.adminReleaseRider(orderId);
      setReleasing(false);
      await refresh();
      onAssigned?.();
    } catch (e) {
      setReleaseError("Could not release the rider: " + e.message);
    } finally {
      setReleaseBusy(false);
    }
  }

  async function handleCancel() {
    if (!cancelNote.trim()) return;
    setCancelBusy(true); setCancelError("");
    try {
      await api.adminCancelOrder(orderId, { refund_amount: refundAmount || "0", note: cancelNote.trim() });
      setCancelling(false);
      setCancelled(true);
      await refresh();
      onAssigned?.();
    } catch (e) {
      setCancelError("Could not cancel this order: " + e.message);
    } finally {
      setCancelBusy(false);
    }
  }

  async function handleRaiseCap() {
    if (!capExtra) return;
    setCapBusy(true); setCapError("");
    try {
      setCapResult(await api.adminRaiseCap(orderId, capExtra));
      setRaisingCap(false);
      setCapExtra("");
    } catch (e) {
      setCapError("Could not raise the cap: " + e.message);
    } finally {
      setCapBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot load per orderId
  }, [orderId]);

  async function handleAssign() {
    if (!pickedAgent) return;
    setError(""); setBusy(true);
    try {
      await api.assignAgent(orderId, pickedAgent);
      await refresh();
      onAssigned?.();
    } catch (e) {
      setError("Could not assign: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  const market = markets.find((m) => m.id === order?.market_id);
  const hub = hubs.find((h) => h.id === order?.hub_id);
  const rider = riders.find((r) => r.user_id && r.user_id === order?.rider_id);
  const marketAgents = agents.filter((a) => a.assigned_market_id === order?.market_id);

  if (!order) {
    return (
      <div>
        <Button variant="neutral" onClick={onBack} className="mb-4">← Back to orders</Button>
        <CardSkeleton />
      </div>
    );
  }

  // Light tint now, not a dark-ink fallback - cream/white surfaces only,
  // per the app's no-dark-surfaces rule. Text over this hero is dark ink,
  // not white, to match.
  const heroBg = market ? TONE_COVER[marketTone(market.name, market.city)].bg : "#F0ECE0";

  return (
    <div>
      {/* Same hero treatment as the customer-facing order screen (see
          screens/OrderDetail.tsx) - market identity + a live status line,
          not a bare "Order xxx…" line, so an admin looking at one order
          sees the same product the customer/agent see, not a different
          back-office skin bolted on. Back floats over the banner itself
          rather than its own row above it, same reasoning as the customer
          version. */}
      <div
        className="relative mb-4 min-h-[160px] overflow-hidden rounded-2xl shadow-md sm:min-h-[200px]"
        style={{ backgroundColor: heroBg }}
      >
        {market && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-full sm:w-[55%]">
            <img
              src={coverImageForMarket(market)}
              alt={market.name}
              className="h-full w-full object-cover object-center"
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(90deg, ${heroBg} 0%, ${heroBg} 12%, ${heroBg}cc 28%, ${heroBg}66 48%, transparent 72%)` }}
            />
            <div
              className="absolute inset-0 sm:hidden"
              style={{ background: `linear-gradient(90deg, ${heroBg} 0%, ${heroBg}e6 35%, ${heroBg}99 55%, transparent 85%)` }}
            />
          </div>
        )}

        <div className="relative z-20 px-4 pt-4 sm:px-5 sm:pt-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to orders"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            <Icon name="chevronDown" className="h-5 w-5 rotate-90" />
          </button>
        </div>

        <div className="relative z-10 flex w-full flex-col justify-center gap-1.5 px-5 pb-5 pt-3 sm:w-[60%] sm:px-6 sm:pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/55">
              {market?.name || "Order"} · #{order.id.slice(0, 8)}
            </p>
            <StatusBadge status={order.status} />
          </div>
          <h2 className="font-display text-xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-2xl">
            {summarizeOrderStatus({ ...order, marketName: market?.name })}
          </h2>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* Same "what's happening" (wide, left) / "manage this order"
          (narrow, right) split as the customer screen - items are the
          status feed here, assignment + the raw record are the admin
          actions/reference. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <Card className="order-2 lg:order-1">
          <p className="mb-2 font-bold text-ink">Items ({(order.items || []).length})</p>
          <div className="space-y-2">
            {(order.items || []).map((it) => (
              <div key={it.id} className="flex items-center justify-between border-b border-line pb-2 text-sm last:border-0">
                <span className="min-w-0 flex-1 truncate text-ink/80">{it.description}</span>
                <span className="shrink-0 font-semibold text-ink">
                  {it.confirmed_price != null ? `₦${it.confirmed_price}` : it.availability}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          {!order.agent_id && (
            <Card className="border-2 border-amber-400">
              <p className="mb-2 font-bold text-ink">Assign an agent</p>
              {marketAgents.length === 0 ? (
                <p className="text-sm text-muted">No agents are registered for this market yet.</p>
              ) : (
                <>
                  <select
                    value={pickedAgent}
                    onChange={(e) => setPickedAgent(e.target.value)}
                    className="mb-2 w-full min-h-[44px] rounded-xl border border-line-strong px-4 text-base text-ink"
                  >
                    <option value="">Select an agent…</option>
                    {marketAgents.map((a) => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.full_name || a.phone} {a.is_available ? "" : "(busy)"}
                      </option>
                    ))}
                  </select>
                  <Button onClick={handleAssign} busy={busy} disabled={!pickedAgent} fullWidth>
                    Assign
                  </Button>
                </>
              )}
            </Card>
          )}

          {order.hub_id && (
            <Card className={releasing ? "border-2 border-amber-400" : ""}>
              <p className="mb-2 font-bold text-ink">Hub &amp; rider</p>
              <div className="space-y-1 text-sm text-ink/80">
                <div className="flex justify-between gap-3"><span>Hub</span><span className="text-right font-semibold">{hub?.name || order.hub_id.slice(0, 8) + "…"}</span></div>
                {hub?.shopkeeper_phone && (
                  <div className="flex justify-between gap-3">
                    <span>Shopkeeper</span>
                    <a href={`tel:${hub.shopkeeper_phone}`} className="font-semibold text-brand-orange-dark hover:underline">{hub.shopkeeper_name || hub.shopkeeper_phone}</a>
                  </div>
                )}
                {order.dropped_at_hub_at && <div className="flex justify-between gap-3"><span>Dropped</span><span className="font-semibold">{new Date(order.dropped_at_hub_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>}
                {order.hub_received_at && <div className="flex justify-between gap-3"><span>Checked in</span><span className="font-semibold">{new Date(order.hub_received_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>}
                {order.packed_at && <div className="flex justify-between gap-3"><span>Ready</span><span className="font-semibold">{new Date(order.packed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>}
                <div className="flex justify-between gap-3">
                  <span>Rider</span>
                  {order.rider_id ? (
                    rider?.phone ? (
                      <a href={`tel:${rider.phone}`} className="font-semibold text-brand-orange-dark hover:underline">{rider.full_name}</a>
                    ) : (
                      <span className="font-semibold">{rider?.full_name || order.rider_id.slice(0, 8) + "…"}</span>
                    )
                  ) : (
                    <span className="font-semibold text-muted">{order.status === "ready_for_pickup" ? "Not claimed yet" : "—"}</span>
                  )}
                </div>
                {order.rider_claimed_at && <div className="flex justify-between gap-3"><span>Claimed</span><span className="font-semibold">{new Date(order.rider_claimed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>}
              </div>

              {/* A rider who claimed it but never turned up: put it back for the others. */}
              {order.status === "ready_for_pickup" && order.rider_id && (
                releasing ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-muted">This takes the job off the rider and puts it back in the pool. Their pickup code stops working.</p>
                    {releaseError && <p className="text-sm text-red-600">{releaseError}</p>}
                    <div className="flex gap-2">
                      <Button variant="neutral" className="flex-1 text-sm" onClick={() => { setReleasing(false); setReleaseError(""); }} disabled={releaseBusy}>Back</Button>
                      <Button className="flex-1 text-sm" onClick={handleReleaseRider} busy={releaseBusy}>Release rider</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="neutral" onClick={() => setReleasing(true)} fullWidth className="mt-3 text-sm">
                    Rider not showing up? Release
                  </Button>
                )
              )}
            </Card>
          )}

          <OrderInterventions
            order={order}
            agents={agents}
            onDone={() => { refresh(); onAssigned?.(); }}
          />

          {order.status === "shopping" && (
            <Card>
              <p className="mb-2 font-bold text-ink">Spending cap</p>
              {capResult && !raisingCap ? (
                <p className="text-sm text-brand-green">Cap raised — now ₦{capResult.cap} (₦{capResult.spent} spent so far).</p>
              ) : raisingCap ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted">For when the customer approved an overage by phone/chat instead of in-app.</p>
                  <Input placeholder="Raise by (₦)" value={capExtra} onChange={(e) => setCapExtra(e.target.value)} />
                  {capError && <p className="text-sm text-red-600">{capError}</p>}
                  <div className="flex gap-2">
                    <Button variant="neutral" className="flex-1 text-sm" onClick={() => { setRaisingCap(false); setCapError(""); }} disabled={capBusy}>Cancel</Button>
                    <Button className="flex-1 text-sm" onClick={handleRaiseCap} busy={capBusy} disabled={!capExtra}>Confirm</Button>
                  </div>
                </div>
              ) : (
                <Button variant="neutral" onClick={() => setRaisingCap(true)} fullWidth className="text-sm">
                  Raise spending cap
                </Button>
              )}
            </Card>
          )}

          {(ADMIN_CANCELLABLE.has(order.status) || cancelled) && (
            <Card className={cancelling ? "border-2 border-red-300" : ""}>
              <p className="mb-2 font-bold text-ink">Cancel this order</p>
              {cancelled ? (
                <p className="text-sm text-brand-green">Order cancelled and refund sent to the customer&apos;s wallet.</p>
              ) : cancelling ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted">
                    For a stuck or disputed order. Enter what the customer actually paid — deposit and/or full payment — so it&apos;s refunded correctly.
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink/70">Refund to wallet (₦)</span>
                    <Input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink/70">Reason (required)</span>
                    <Input placeholder="e.g. customer reported it never arrived" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
                  </label>
                  {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
                  <div className="flex gap-2">
                    <Button variant="neutral" className="flex-1 text-sm" onClick={() => { setCancelling(false); setCancelError(""); }} disabled={cancelBusy}>Back</Button>
                    <Button className="flex-1 !bg-red-600 text-sm hover:!bg-red-700" onClick={handleCancel} busy={cancelBusy} disabled={!cancelNote.trim()}>
                      Confirm cancel &amp; refund
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="neutral" onClick={() => setCancelling(true)} fullWidth className="text-sm !text-red-600">
                  Cancel &amp; refund
                </Button>
              )}
            </Card>
          )}

          <Card>
            <p className="mb-2 font-bold text-ink">Order record</p>
            <div className="space-y-1 text-ink/80">
              <div className="flex justify-between"><span>Market</span><span className="font-semibold">{market ? `${market.name}, ${market.city}` : order.market_id.slice(0, 8) + "…"}</span></div>
              <div className="flex justify-between"><span>Customer</span><span className="font-semibold">{order.customer_id.slice(0, 8)}…</span></div>
              <div className="flex justify-between"><span>Agent</span><span className="font-semibold">{order.agent_id ? order.agent_id.slice(0, 8) + "…" : "Unassigned"}</span></div>
              <div className="flex justify-between"><span>Created</span><span className="font-semibold">{new Date(order.created_at).toLocaleString()}</span></div>
              {order.grand_total > 0 && (
                <div className="flex justify-between"><span>Grand total</span><span className="font-semibold">₦{order.grand_total}</span></div>
              )}
              {order.hub_id && (
                <div className="flex justify-between"><span>Hub</span><span className="font-semibold">{hub?.name || order.hub_id.slice(0, 8) + "…"}</span></div>
              )}
              {order.courier_reference && (
                <div className="flex justify-between"><span>Courier ref</span><span className="font-semibold">{order.courier_reference}</span></div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AdminOrders() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [now, setNow] = useState<any>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const search = usePageSearch("Search orders, markets, agents…");

  async function refresh() {
    try {
      const [flight, marketList] = await Promise.all([
        api.getInFlightOrders(),
        api.getAllMarkets(),
      ]);
      setData(flight);
      setMarkets(marketList);
      setNow(Date.now());
      setError("");
    } catch (e) {
      setError("Could not load orders. (" + e.message + ")");
    }
  }

  usePolling(refresh, POLL_MS);

  const marketName = (id) => markets.find((m) => m.id === id)?.name || id.slice(0, 8) + "…";

  const all: any[] = data?.orders ?? [];
  const unassigned = all.filter((o) => !o.agent_id).length;
  const stuckCount = all.filter((o) => o.stuck).length;
  const shoppingCount = all.filter((o) => o.status === "shopping").length;
  const HUB_STATUSES = ["dropped_at_hub", "received_by_hub", "ready_for_pickup"];
  const atHub = all.filter((o) => HUB_STATUSES.includes(o.status)).length;
  const needsRider = all.filter((o) => o.status === "ready_for_pickup" && !o.rider_id).length;
  const visible = all.filter((o) => {
    if (filter === "unassigned" && o.agent_id) return false;
    if (filter === "at_hub" && !HUB_STATUSES.includes(o.status)) return false;
    if (filter === "needs_rider" && !(o.status === "ready_for_pickup" && !o.rider_id)) return false;
    if (filter === "stuck" && !o.stuck) return false;
    if (!search) return true;
    return [o.status, marketName(o.market_id), o.agent_id, o.customer_id, o.id].some((v) =>
      String(v || "").toLowerCase().includes(search)
    );
  });

  return (
    <div>
      <AdminPageHeader icon="basket" section="Operations" title="Orders" description="Every order still in flight — not yet delivered, closed, or cancelled.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="In flight" value={all.length} />
          <StatTile label="Being shopped" value={shoppingCount} />
          <StatTile label="At a hub" value={atHub} />
          <StatTile label="Needs a rider" value={needsRider} />
          <StatTile label="Stuck" value={stuckCount} />
        </div>
      </AdminPageHeader>

      {data && all.length > 0 && (
        <FilterPills
          options={[
            { key: "all", label: `All (${all.length})` },
            { key: "unassigned", label: `Unassigned (${unassigned})` },
            { key: "at_hub", label: `At a hub (${atHub})` },
            { key: "needs_rider", label: `Needs a rider (${needsRider})` },
            { key: "stuck", label: `Stuck (${stuckCount})` },
          ]}
          value={filter}
          onChange={setFilter}
        />
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : data.orders.length === 0 ? (
        <EmptyState icon="basket" title="Nothing in flight" subtitle="Every order is delivered, closed, or cancelled." />
      ) : visible.length === 0 ? (
        <EmptyState icon="basket" title="No matching orders" subtitle="Try a different filter or search." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Market</th>
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Age</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const stuck = !!o.stuck;
                return (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/admin/orders/${o.id}`)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken-2"
                  >
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-ink/80">{marketName(o.market_id)}</td>
                    <td className="px-4 py-3">
                      {o.agent_id ? (
                        <span className="text-ink/80">{o.agent_id.slice(0, 8)}…</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{o.customer_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      <span className={stuck ? "flex items-center gap-1 font-bold text-red-600" : "text-muted"}>
                        {stuck && <Icon name="alert" className="h-3.5 w-3.5" />}
                        {formatAge(now - new Date(o.created_at).getTime())}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-faint">›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminOrders;
