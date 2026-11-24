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

function HubCard({ hub, busy, onToggle, onRename, multiple }: any) {
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
        description="A hub is a drop-off point in a market run by a shopkeeper: agents leave bought goods there and the shopkeeper hands them to a rider."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Pending applications" value={applications?.length ?? "—"} />
          <StatTile label="Hubs" value={hubs?.length ?? "—"} />
          <StatTile label="Active" value={hubs ? hubs.filter((h) => h.is_active).length : "—"} tone="green" />
          <StatTile label="Orders at hubs" value={hubs ? hubs.reduce((n, h) => n + h.orders_at_hub, 0) : "—"} />
        </div>
      </AdminPageHeader>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <SectionHeader
        icon="flag"
        title="Pending applications"
        subtitle="Call to vet them, then approve or reject. Approving creates their account and their hub."
        className="mb-3"
      />
      {applications === null ? (
        <div className="mb-8 space-y-2">{[0, 1].map((i) => <CardSkeleton key={i} />)}</div>
      ) : applications.length === 0 ? (
        <div className="mb-8">
          <EmptyState icon="pin" title="Nothing pending" subtitle="New shopkeeper applications will show up here." />
        </div>
      ) : (
        <div className="mb-8 space-y-2">
          {applications.map((a) => (
            <ApplicationCard
              key={a.id}
              app={a}
              place={marketName(a.market_id)}
              busy={busyId === a.id}
              onDecide={decide}
            />
          ))}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
