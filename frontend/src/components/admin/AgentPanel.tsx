'use client';

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errMsg } from "@/lib/hubUtils";
import { useAuth } from "@/components/auth/AuthProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import StatTile from "@/components/ui/StatTile";
import StatusBadge from "@/components/ui/StatusBadge";
import UserAdminActions from "@/components/admin/UserAdminActions";

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

// One agent, everything an admin can do about them in one place: check their
// ID, switch them on or off duty, suspend them, move them, stand them down.
export default function AgentPanel({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const { user: me } = useAuth();
  const isOwner = me?.admin_level === "owner";
  const [agent, setAgent] = useState<any>(null);
  const [account, setAccount] = useState<any>(null); // the generic user record UserAdminActions edits
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const load = useCallback(async () => {
    try {
      const [a, u] = await Promise.all([api.getAgentDetail(userId), api.getUserDetail(userId)]);
      setAgent(a);
      setAccount(u);
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<any>, message: string, clearNote = true) {
    setError(""); setDone(""); setBusy(true);
    try {
      await fn();
      setDone(message);
      if (clearNote) setNote("");
      await load();
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const suspended = agent?.account_status === "suspended";

  return (
    <Modal open onClose={onClose} title={agent?.full_name || agent?.phone || "Agent"} className="!max-w-xl max-h-[88vh] overflow-y-auto">
      {!agent ? (
        <p className="py-8 text-center text-muted">{error || "Loading…"}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{agent.phone}{agent.email ? ` · ${agent.email}` : ""}</span>
            <span className={"rounded-full px-2.5 py-0.5 text-xs font-bold " + (agent.verified ? "bg-brand-green/10 text-brand-green" : "bg-amber-50 text-amber-700")}>
              {agent.verified ? "ID verified" : "Not verified"}
            </span>
            <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs font-bold text-muted">
              {!agent.on_duty ? "Off duty" : agent.is_available ? "Available" : "Busy"}
            </span>
            {suspended && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700">Suspended</span>}
          </div>
          {agent.market_name && <p className="-mt-3 text-sm text-muted">Covers {agent.market_name}</p>}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Completed" value={agent.completed_orders} />
            <StatTile label="In progress" value={agent.orders_in_progress} />
            <StatTile label="Earned" value={`₦${agent.earnings_total}`} tone="green" />
            <StatTile label="Rating" value={agent.rating_average ? `${agent.rating_average} ★ (${agent.rating_count})` : "—"} />
          </div>

          {/* Verification */}
          <div className="rounded-2xl bg-sunken-2/70 p-4">
            <p className="font-bold text-ink">ID verification</p>
            {agent.verified ? (
              <p className="mt-1 text-sm text-muted">
                Verified {when(agent.verified_at)}{agent.verified_by ? ` by ${agent.verified_by}` : ""}.
                {agent.verification_note ? ` "${agent.verification_note}"` : ""}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Call them, check their ID, then record it here.
                {agent.verification_note ? ` Last note: "${agent.verification_note}"` : ""}
              </p>
            )}
            <Input
              className="mt-3"
              placeholder={agent.verified ? "Reason for withdrawing (required)" : "What you checked, e.g. NIN slip, matched face (optional)"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
            <div className="mt-2 flex gap-2">
              {agent.verified ? (
                <Button variant="neutral" busy={busy} disabled={note.trim().length < 3} onClick={() => run(() => api.unverifyAgent(userId, note.trim()), "Verification withdrawn.")}>
                  Withdraw verification
                </Button>
              ) : (
                <Button busy={busy} onClick={() => run(() => api.verifyAgent(userId, note.trim() || undefined), "Agent verified. They've been told.")}>
                  Verify this agent
                </Button>
              )}
            </div>
          </div>

          {/* Control */}
          <div>
            <p className="mb-2 text-sm font-semibold text-muted">Control</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="neutral" className="text-sm" busy={busy} onClick={() => run(() => api.setAgentDutyAdmin(userId, !agent.on_duty), agent.on_duty ? "Taken off duty." : "Put on duty.", false)}>
                {agent.on_duty ? "Take off duty" : "Put on duty"}
              </Button>
              <Button variant="neutral" className="text-sm" busy={busy} onClick={() => run(() => (suspended ? api.reactivateUser(userId) : api.suspendUser(userId)), suspended ? "Account reactivated." : "Account suspended.", false)}>
                {suspended ? "Reactivate account" : "Suspend account"}
              </Button>
            </div>
          </div>

          {account && <UserAdminActions detail={account} onChanged={() => { void load(); onChanged(); }} />}

          {agent.recent_orders.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-muted">Recent orders</p>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {agent.recent_orders.map((o: any) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="font-mono text-ink/70">#{o.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-xs text-faint">{when(o.created_at)}</span>
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {done && <p className="rounded-2xl bg-brand-green/10 px-4 py-3 text-sm font-semibold text-brand-green">{done}</p>}
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
