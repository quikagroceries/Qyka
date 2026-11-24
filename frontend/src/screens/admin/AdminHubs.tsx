'use client';

import { useState } from "react";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { errMsg } from "@/lib/hubUtils";
import StatTile from "@/components/ui/StatTile";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { usePageSearch } from "@/components/layout/PageSearchContext";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ApplicationCard from "@/components/admin/ApplicationCard";
import { useAuth } from "@/components/auth/AuthProvider";

// The roster changes slowly; paused while the tab is hidden (usePolling).
const POLL_MS = 20000;

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-bold " +
        (active ? "bg-brand-green/10 text-brand-green" : "bg-amber-50 text-amber-700")
      }
    >
      {active ? "Active" : "Switched off"}
    </span>
  );
}

function ChangeShopkeeper({ hub, onDone }: { hub: any; onDone: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <Button variant="neutral" className="text-sm" onClick={() => setOpen(true)}>
        Change shopkeeper
      </Button>
    );
  }
  return (
    <div className="mt-1 w-full space-y-2 rounded-2xl bg-sunken p-3">
      <p className="text-sm text-muted">
        The new person signs in with a code sent to their phone. The current shopkeeper becomes an ordinary customer.
        This is refused while orders are sitting in the hub.
      </p>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New shopkeeper's name" />
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Their phone number" inputMode="tel" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button variant="neutral" className="text-sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        <Button
          className="text-sm"
          busy={busy}
          disabled={name.trim().length < 2 || phone.trim().length < 8}
          onClick={async () => {
            setError(""); setBusy(true);
            try {
              await api.replaceShopkeeper(hub.id, { full_name: name.trim(), phone: phone.trim() });
              setOpen(false);
              await onDone();
            } catch (e) {
              setError(errMsg(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Hand over the hub
        </Button>
      </div>
    </div>
  );
}

function AddHubCard({ markets, onAdded }: { markets: any[]; onAdded: () => Promise<void> | void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketId, setMarketId] = useState("");
  const [hubName, setHubName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<any>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const hub = await api.createHub({
        full_name: name.trim(), phone: phone.trim(), market_id: marketId,
        hub_name: hubName.trim() || undefined,
      });
      setAdded(hub);
      setName(""); setPhone(""); setHubName(""); setMarketId("");
      await onAdded();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-8">
      <SectionHeader
        icon="plus"
        title="Add a hub"
        subtitle="Set up the hub and its shopkeeper together. Shopkeepers are only ever added here - there's no public application, because a hub holds other people's goods."
        className="mb-4"
      />
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Shopkeeper's full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input placeholder="Their phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <select
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
          required
          className="min-h-[44px] rounded-xl border border-line-strong bg-surface px-4 text-base text-ink"
        >
          <option value="">Which market?</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <Input placeholder="Hub name (optional, e.g. Main Gate)" value={hubName} onChange={(e) => setHubName(e.target.value)} maxLength={120} />
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" busy={busy} disabled={!marketId}>Add hub</Button>
        </div>
      </form>
      {added && (
        <div className="mt-4 rounded-2xl bg-brand-green/10 p-4 text-sm text-ink">
          <p className="font-semibold">{added.name} is ready.</p>
          <p className="mt-1 text-muted">
            Tell {added.shopkeeper_name || "the shopkeeper"} to sign in to Qyka with {added.shopkeeper_phone} - they&apos;ll get a code by SMS and land on their hub.
          </p>
        </div>
      )}
    </Card>
  );
}

function HubCard({ hub, busy, onToggle, onRename, multiple, onChanged }: any) {
  const { user: me } = useAuth();
  const isOwner = me?.admin_level === "owner";
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(hub.name);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {renaming ? (
            <div className="flex items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="min-w-0" />
              <Button
                className="text-sm"
                busy={busy}
                disabled={!name.trim() || name.trim() === hub.name}
                onClick={async () => {
                  if (await onRename(hub, name)) setRenaming(false);
                }}
              >
                Save
              </Button>
              <Button variant="neutral" className="text-sm" onClick={() => { setRenaming(false); setName(hub.name); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className="font-display text-lg font-extrabold text-ink">{hub.name}</p>
          )}
          <p className="text-sm text-muted">{hub.market_name || "Unknown market"}</p>
        </div>
        <StatusPill active={hub.is_active} />
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-faint">Shopkeeper</dt>
          <dd className="text-ink/80">{hub.shopkeeper_name || "—"}</dd>
          {hub.shopkeeper_phone && (
            <a href={`tel:${hub.shopkeeper_phone}`} className="text-xs font-semibold text-brand-orange-dark hover:underline">
              {hub.shopkeeper_phone}
            </a>
          )}
        </div>
        <div>
          <dt className="text-xs text-faint">Orders at the hub now</dt>
          <dd className="font-semibold text-ink">{hub.orders_at_hub}</dd>
        </div>
      </dl>

      {multiple && (
        <p className="text-xs text-faint">This market has several hubs - agents choose by name, so keep them distinct.</p>
      )}

      <div className="flex gap-2">
        {!renaming && (
          <Button variant="neutral" className="text-sm" onClick={() => setRenaming(true)}>
            Rename
          </Button>
        )}
        <Button variant="neutral" className="text-sm" busy={busy} onClick={() => onToggle(hub)}>
          {hub.is_active ? "Switch off" : "Switch on"}
        </Button>
        {isOwner && <ChangeShopkeeper hub={hub} onDone={onChanged} />}
      </div>
      {hub.is_active === false && hub.orders_at_hub > 0 && (
        <p className="text-xs text-muted">Switched off: no new drop-offs, but the orders already here carry on.</p>
      )}
    </Card>
  );
}

export default function AdminHubs() {
  const [applications, setApplications] = useState<any[] | null>(null);
  const [hubs, setHubs] = useState<any[] | null>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const search = usePageSearch("Search hubs…");
  const { user: me } = useAuth();
  const isOwnerPage = me?.admin_level === "owner";

  async function refresh() {
    try {
      const [apps, hubList, marketList] = await Promise.all([
        api.getAgentApplications("pending", "shopkeeper"),
        api.listHubs(),
        api.getAllMarkets(),
      ]);
      setApplications(apps);
      setHubs(hubList);
      setMarkets(marketList);
      setError("");
    } catch (e) {
      setError("Could not load hubs. " + errMsg(e));
    }
  }
  usePolling(refresh, POLL_MS);

  async function run(id: string, fn: () => Promise<any>, failure: string): Promise<boolean> {
    setError("");
    setBusyId(id);
    try {
      await fn();
      await refresh();
      return true;
    } catch (e) {
      setError(failure + " " + errMsg(e));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const marketName = (id: string) => markets.find((m) => m.id === id)?.name;
  const decide = (id: string, decision: "approve" | "reject") =>
    run(
      id,
      () => (decision === "approve" ? api.approveAgentApplication(id) : api.rejectAgentApplication(id)),
      `Could not ${decision}.`,
    );
  const toggle = (hub: any) =>
    run(hub.id, () => api.updateHub(hub.id, { is_active: !hub.is_active }), "Could not update this hub.");
  const rename = (hub: any, name: string) =>
    run(hub.id, () => api.updateHub(hub.id, { name: name.trim() }), "Could not rename this hub.");

  const perMarket: Record<string, number> = {};
  (hubs || []).forEach((h) => (perMarket[h.market_id] = (perMarket[h.market_id] || 0) + 1));
  const visible = (hubs || []).filter(
    (h) => !search || [h.name, h.market_name, h.shopkeeper_name, h.shopkeeper_phone].some((v) => String(v || "").toLowerCase().includes(search)),
  );

  return (
    <div>
      <AdminPageHeader
        icon="pin"
        section="People"
        title="Hubs"
        description="A hub is a drop-off point in a market run by a shopkeeper you set up: agents leave bought goods there and the shopkeeper hands them to a rider."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Pending applications" value={applications?.length ?? "—"} />
          <StatTile label="Hubs" value={hubs?.length ?? "—"} />
          <StatTile label="Active" value={hubs ? hubs.filter((h) => h.is_active).length : "—"} tone="green" />
          <StatTile label="Orders at hubs" value={hubs ? hubs.reduce((n, h) => n + h.orders_at_hub, 0) : "—"} />
        </div>
      </AdminPageHeader>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {isOwnerPage && <AddHubCard markets={markets} onAdded={refresh} />}

      {/* Shopkeepers can no longer apply publicly; this only shows any that
          were already waiting from before that changed. */}
      {applications && applications.length > 0 && (
        <div className="mb-8">
          <SectionHeader
            icon="flag"
            title="Applications from before"
            subtitle="Approve or reject these; no new ones can come in."
            className="mb-3"
          />
          <div className="space-y-2">
            {applications.map((a2) => (
              <ApplicationCard key={a2.id} app={a2} place={marketName(a2.market_id)} busy={busyId === a2.id} onDecide={decide} />
            ))}
          </div>
        </div>
      )}

      <SectionHeader icon="pin" title="All hubs" subtitle="Rename a hub or switch it off. Switching off only stops new drop-offs." className="mb-3" />
      {hubs === null ? (
        <div className="space-y-2">{[0, 1].map((i) => <CardSkeleton key={i} />)}</div>
      ) : hubs.length === 0 ? (
        <EmptyState icon="pin" title="No hubs yet" subtitle="Approve a shopkeeper application to create the first one." />
      ) : visible.length === 0 ? (
        <EmptyState icon="search" title="No matches" subtitle="No hub matches that search." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((h) => (
            <HubCard
              key={h.id}
              hub={h}
              busy={busyId === h.id}
              multiple={perMarket[h.market_id] > 1}
              onToggle={toggle}
              onRename={rename}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
