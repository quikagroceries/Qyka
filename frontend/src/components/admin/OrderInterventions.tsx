'use client';

import { useState } from "react";
import { api } from "@/lib/api";
import { errMsg } from "@/lib/hubUtils";
import { useAuth } from "@/components/auth/AuthProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type Tool = null | "agent" | "stage" | "confirm";

const HUB_STAGES = [
  { key: "dropped_at_hub", label: "Dropped at the hub (not yet checked in)" },
  { key: "received_by_hub", label: "Checked in (not yet ready)" },
  { key: "ready_for_pickup", label: "Ready for a rider" },
];

// For when an order has gone off the rails and someone has to step in. Every
// action needs a reason, is written to the audit log, and is refused by the
// server where it would corrupt money or custody.
export default function OrderInterventions({ order, agents, onDone }: { order: any; agents: any[]; onDone: () => void }) {
  const { user: me } = useAuth();
  const isOwner = me?.admin_level === "owner";
  const [tool, setTool] = useState<Tool>(null);
  const [note, setNote] = useState("");
  const [agentId, setAgentId] = useState("");
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const canReassign = order.status === "agent_assigned" || order.status === "shopping";
  const atHub = ["dropped_at_hub", "received_by_hub", "ready_for_pickup"].includes(order.status);
  const canConfirm = order.status === "out_for_delivery";
  const available = [
    canReassign && { key: "agent" as Tool, label: "Swap the agent" },
    isOwner && atHub && { key: "stage" as Tool, label: "Fix the hub step" },
    isOwner && canConfirm && { key: "confirm" as Tool, label: "Confirm delivery for the customer" },
  ].filter(Boolean) as { key: Tool; label: string }[];
  if (available.length === 0) return null;

  async function run(fn: () => Promise<any>, message: string) {
    setError(""); setDone(""); setBusy(true);
    try {
      await fn();
      setDone(message);
      setTool(null); setNote(""); setAgentId(""); setStage("");
      onDone();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const noteOk = note.trim().length >= 3;
  const choices = agents.filter((a) => a.user_id !== order.agent_id);

  return (
    <Card className={tool ? "border-2 border-amber-400" : ""}>
      <p className="mb-2 font-bold text-ink">Step in</p>
      <div className="flex flex-wrap gap-2">
        {available.map((t) => (
          <Button key={t.key as string} variant="neutral" className="text-sm" onClick={() => { setTool(tool === t.key ? null : t.key); setError(""); setDone(""); }}>
            {t.label}
          </Button>
        ))}
      </div>

      {tool && (
        <div className="mt-3 space-y-2">
          {tool === "agent" && (
            <>
              <p className="text-sm text-muted">Move this order to another agent. Anything the customer has approved stays as it is.</p>
              <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-line-strong bg-surface px-4 text-base text-ink">
                <option value="">Choose an agent…</option>
                {choices.map((a) => (
                  <option key={a.user_id} value={a.user_id}>{a.full_name || a.phone}{a.is_available ? "" : " (busy)"}</option>
                ))}
              </select>
            </>
          )}
          {tool === "stage" && (
            <>
              <p className="text-sm text-muted">Put the order at the right step of the hub&apos;s chain. A rider&apos;s claim is cancelled if you move it back.</p>
              <select value={stage} onChange={(e) => setStage(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-line-strong bg-surface px-4 text-base text-ink">
                <option value="">Choose a step…</option>
                {HUB_STAGES.filter((s) => s.key !== order.status).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </>
          )}
          {tool === "confirm" && (
            <p className="text-sm text-muted">
              Use this when the goods arrived but the customer can&apos;t confirm. It releases the agent, rider and hub payouts exactly as their own tap would.
            </p>
          )}
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (required, kept in the audit log)" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="neutral" className="flex-1 text-sm" onClick={() => setTool(null)} disabled={busy}>Back</Button>
            <Button
              className="flex-1 text-sm"
              busy={busy}
              disabled={!noteOk || (tool === "agent" && !agentId) || (tool === "stage" && !stage)}
              onClick={() =>
                tool === "agent" ? run(() => api.reassignAgent(order.id, agentId, note.trim()), "Agent changed.")
                : tool === "stage" ? run(() => api.setHubStage(order.id, stage, note.trim()), "Hub step corrected.")
                : run(() => api.adminConfirmDelivery(order.id, note.trim()), "Delivery confirmed and payouts released.")
              }
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
      {done && !tool && <p className="mt-2 text-sm font-semibold text-brand-green">{done}</p>}
    </Card>
  );
}
