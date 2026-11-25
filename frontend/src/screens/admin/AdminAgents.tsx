'use client';

import StatTile from "@/components/ui/StatTile";
import SectionHeader from "@/components/ui/SectionHeader";
import { usePageSearch } from "@/components/layout/PageSearchContext";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ApplicationCard from "@/components/admin/ApplicationCard";
import AgentPanel from "@/components/admin/AgentPanel";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { usePolling } from "@/lib/usePolling";

// The roster changes slowly; paused while the tab is hidden (usePolling).
const POLL_MS = 20000;

function AdminAgents() {
  const [applications, setApplications] = useState<any>(null);
  const [agents, setAgents] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<any>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const search = usePageSearch("Search agents…");

  async function refresh() {
    try {
      const [apps, agentList, marketList] = await Promise.all([
        api.getAgentApplications("pending", "agent"),
        api.listAgents(),
        api.getAllMarkets(),
      ]);
      setApplications(apps);
      setAgents(agentList);
      setMarkets(marketList);
      setError("");
    } catch (e) {
      setError("Could not load agents. (" + e.message + ")");
    }
  }

  usePolling(refresh, POLL_MS);

  async function handleDecide(applicationId, decision) {
    setError(""); setBusyId(applicationId);
    try {
      if (decision === "approve") await api.approveAgentApplication(applicationId);
      else if (decision === "approve_verify") {
        // Approve first (it creates the agent), then record the ID check.
        const approved: any = await api.approveAgentApplication(applicationId);
        await api.verifyAgent(approved.user_id, "Verified when approved");
      } else await api.rejectAgentApplication(applicationId);
      await refresh();
    } catch (e) {
      setError("Could not " + decision + ": " + e.message);
    } finally {
      setBusyId(null);
    }
  }

  const marketName = (id) => markets.find((m) => m.id === id)?.name || (id ? id.slice(0, 8) + "…" : "—");

  return (
    <div>
      <AdminPageHeader icon="user" section="People" title="Agents" description="Approve applicants and see who&apos;s covering each market.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label="Pending applications" value={applications?.length ?? "—"} />
          <StatTile label="Agents" value={agents?.length ?? "—"} />
          <StatTile label="Not verified" value={agents ? agents.filter((a) => !a.verified).length : "—"} />
          <StatTile label="Available now" value={agents ? agents.filter((a) => a.on_duty && a.is_available).length : "—"} tone="green" />
          <StatTile label="Completed runs" value={agents ? agents.reduce((n, a) => n + (a.completed_orders || 0), 0) : "—"} />
        </div>
      </AdminPageHeader>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <SectionHeader icon="flag" title="Pending applications" subtitle="From the website and from customers in the app. Approving makes their phone number an agent account." className="mb-3" />
      {applications === null ? (
        <div className="mb-8 space-y-2">{[0, 1].map((i) => <CardSkeleton key={i} />)}</div>
      ) : applications.length === 0 ? (
        <div className="mb-8">
          <EmptyState icon="user" title="Nothing pending" subtitle="New agent applications will show up here." />
        </div>
      ) : (
        <div className="mb-8 space-y-2">
          {applications.map((a) => (
            <ApplicationCard key={a.id} app={a} place={marketName(a.market_id)} busy={busyId === a.id} onDecide={handleDecide} canVerify />
          ))}
        </div>
      )}

      <SectionHeader icon="user" title="All agents" subtitle="Tap an agent to verify their ID, switch their duty, suspend, move or stand them down." className="mb-3" />
      {agents === null ? (
        <div className="space-y-2">{[0, 1].map((i) => <CardSkeleton key={i} />)}</div>
      ) : agents.length === 0 ? (
        <EmptyState icon="user" title="No agents yet" subtitle="Approved applicants will show up here." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Market</th>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Completed</th>
                <th className="px-4 py-3 font-semibold">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {agents.filter((a) => !search || [a.full_name, a.phone, marketName(a.assigned_market_id)].some((v) => String(v || "").toLowerCase().includes(search))).map((a) => (
                <tr key={a.id} onClick={() => setOpenId(a.user_id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken-2/60">
                  <td className="px-4 py-3 font-semibold text-ink">
                    {a.full_name || a.phone}
                    {a.account_status === "suspended" && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">Suspended</span>}
                  </td>
                  <td className="px-4 py-3 text-ink/80">{marketName(a.assigned_market_id)}</td>
                  <td className="px-4 py-3">
                    <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + (a.verified ? "bg-brand-green/10 text-brand-green" : "bg-amber-50 text-amber-700")}>
                      {a.verified ? "Verified" : "Not verified"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={
                      "rounded-full px-2 py-0.5 text-xs font-bold " +
                      (a.on_duty && a.is_available
                        ? "bg-brand-green/10 text-brand-green"
                        : a.on_duty
                          ? "bg-amber-50 text-amber-700"
                          : "bg-sunken text-muted")
                    }>
                      {!a.on_duty ? "Off duty" : a.is_available ? "Available" : "Busy"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/80">{a.completed_orders}</td>
                  <td className="px-4 py-3 font-semibold text-ink">₦{a.earnings_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId && <AgentPanel userId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </div>
  );
}

export default AdminAgents;
