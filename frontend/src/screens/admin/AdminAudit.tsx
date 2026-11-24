'use client';

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errMsg } from "@/lib/hubUtils";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FilterPills from "@/components/ui/FilterPills";
import StatTile from "@/components/ui/StatTile";
import { CardSkeleton } from "@/components/ui/Skeleton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const PAGE = 50;

// Group filters match the dotted action names the server logs ("user.suspend").
const GROUPS = [
  { key: "", label: "Everything" },
  { key: "admin", label: "Sign-ins" },
  { key: "user.", label: "People" },
  { key: "order.", label: "Orders" },
  { key: "fees.", label: "Delivery pay" },
  { key: "settings.", label: "Platform settings" },
  { key: "admins.", label: "Admins" },
  { key: "hub.", label: "Hubs & riders" },
];

// What each action means, in words a non-developer reads at a glance.
const LABELS: Record<string, string> = {
  "admin.login": "Signed in",
  "admin.login_failed": "Failed sign-in attempt",
  "admin.password_change": "Changed their password",
  "admins.create": "Added an admin",
  "admins.remove": "Removed an admin",
  "admins.set_level": "Changed an admin's level",
  "user.suspend": "Suspended a user",
  "user.reactivate": "Reactivated a user",
  "user.clear_flag": "Cleared a customer's flag",
  "user.wallet_adjust": "Adjusted a wallet",
  "order.cancel": "Cancelled an order and refunded",
  "order.raise_cap": "Raised an order's spending cap",
  "order.assign_agent": "Assigned an agent",
  "order.release_rider": "Released a rider's claim",
  "vendor_transfer.acknowledge": "Acknowledged a failed vendor payout",
  "rider.set_status": "Suspended or reactivated a rider",
  "rider.link_account": "Gave a rider a login",
  "hub.update": "Changed a hub",
  "application.approve": "Approved an application",
  "application.reject": "Rejected an application",
  "market.create": "Created a market",
  "market.update": "Changed a market",
  "fees.set_default": "Set the default delivery pay",
  "fees.set_market": "Set a market's delivery pay",
  "fees.clear_market": "Reset a market's delivery pay",
  "settings.update": "Changed a platform setting",
  "settings.reset": "Reset a platform setting to default",
  "float.top_up": "Topped up the float",
  "float.transfer": "Moved float between markets",
  "orders.expire_stale": "Expired overdue orders",
};

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// The bit of detail worth reading inline: a setting's old -> new value.
function summary(e: any) {
  const d = e.detail || {};
  if (d.key !== undefined && d.old !== undefined) return `${d.key}: ${d.old} → ${d.new}`;
  const target = e.target ? Object.values(e.target)[0] : null;
  return target ? String(target).slice(0, 8) + "…" : "";
}

export default function AdminAudit() {
  const [group, setGroup] = useState("");
  const [adminId, setAdminId] = useState("");
  const [admins, setAdmins] = useState<any[]>([]);
  const [rows, setRows] = useState<any[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api.listAdmins().then(setAdmins).catch(() => {});
  }, []);

  async function load(reset: boolean) {
    try {
      if (!reset) setLoadingMore(true);
      const data = await api.getAuditLog({
        action: group || undefined, adminId: adminId || undefined,
        limit: PAGE, offset: reset ? 0 : rows?.length ?? 0,
      });
      setRows((cur) => (reset || !cur ? data.entries : [...cur, ...data.entries]));
      setTotal(data.total);
      setError("");
    } catch (e) {
      setError("Could not load the audit log. " + errMsg(e));
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setRows(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload whenever a filter changes
  }, [group, adminId]);

  return (
    <div>
      <AdminPageHeader
        icon="clock"
        section="Accountability"
        title="Audit log"
        description="Every change an admin makes, who made it and when. It can't be edited or deleted from here."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Entries" value={rows ? total : "—"} />
        </div>
      </AdminPageHeader>

      <FilterPills options={GROUPS.map((g) => ({ key: g.key || "all", label: g.label }))} value={group || "all"} onChange={(k: string) => setGroup(k === "all" ? "" : k)} />
      <div className="mb-4">
        <select
          value={adminId}
          onChange={(e) => setAdminId(e.target.value)}
          className="min-h-[44px] rounded-xl border border-line-strong bg-surface px-4 text-base text-ink"
          aria-label="Filter by admin"
        >
          <option value="">Everyone</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>{a.full_name || a.email} ({a.level})</option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {rows === null ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="clock" title="Nothing logged yet" subtitle="Admin actions will appear here as they happen." />
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((e) => {
              const failed = e.action === "admin.login_failed";
              return (
                <Card key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 !p-4">
                  <div className="min-w-0">
                    <p className={"font-semibold " + (failed ? "text-red-600" : "text-ink")}>
                      {LABELS[e.action] || e.action}
                    </p>
                    <p className="text-sm text-muted">
                      {e.admin_email || "Unknown"}
                      {e.admin_level && <span className="ml-1.5 rounded-full bg-sunken px-2 py-0.5 text-xs font-bold capitalize text-muted">{e.admin_level}</span>}
                    </p>
                    {summary(e) && <p className="mt-0.5 break-all font-mono text-xs text-faint">{summary(e)}</p>}
                  </div>
                  <div className="text-right text-xs text-faint">
                    <p>{when(e.created_at)}</p>
                    {e.ip && <p>{e.ip}</p>}
                  </div>
                </Card>
              );
            })}
          </div>
          {rows.length < total && (
            <div className="mt-4 text-center">
              <Button variant="neutral" busy={loadingMore} onClick={() => load(false)}>
                Show older ({total - rows.length} more)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
