'use client';

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errMsg } from "@/lib/hubUtils";
import { useAuth } from "@/components/auth/AuthProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type Panel = null | "edit" | "role" | "market";

const ROLE_LABEL: Record<string, string> = { agent: "agent", rider: "rider", shopkeeper: "shopkeeper" };

// The things that used to mean "ask a developer": fix someone's details, move
// an agent to another market, stand someone down from their job. Each one is
// refused by the server while the person still holds work, and says why.
export default function UserAdminActions({ detail, onChanged }: { detail: any; onChanged: () => void }) {
  const { user: me } = useAuth();
  const isOwner = me?.admin_level === "owner";
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const [name, setName] = useState(detail.full_name || "");
  const [phone, setPhone] = useState(detail.phone || "");
  const [email, setEmail] = useState(detail.email || "");
  const [cap, setCap] = useState(String(Math.round((detail.basket_cap_kobo || 0) / 100)));
  const [note, setNote] = useState("");
  const [markets, setMarkets] = useState<any[]>([]);
  const [marketId, setMarketId] = useState("");

  useEffect(() => {
    if (detail.role === "agent") api.getAllMarkets().then(setMarkets).catch(() => {});
  }, [detail.role]);

  async function run(fn: () => Promise<any>, message: string) {
    setError(""); setDone(""); setBusy(true);
    try {
      await fn();
      setDone(message);
      setPanel(null);
      setNote("");
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const canEnd = isOwner && ROLE_LABEL[detail.role];
  const canMove = detail.role === "agent";
  if (!isOwner && !canMove) return null;

  return (
    <div className="border-t border-line pt-4">
      <p className="mb-2 text-sm font-semibold text-muted">Manage</p>
      <div className="flex flex-wrap gap-2">
        {isOwner && <Button variant="neutral" className="text-sm" onClick={() => setPanel(panel === "edit" ? null : "edit")}>Edit details</Button>}
        {canMove && <Button variant="neutral" className="text-sm" onClick={() => setPanel(panel === "market" ? null : "market")}>Move to another market</Button>}
        {canEnd && <Button variant="neutral" className="text-sm !text-red-600" onClick={() => setPanel(panel === "role" ? null : "role")}>Stand down as {ROLE_LABEL[detail.role]}</Button>}
      </div>

      {panel === "edit" && (
        <div className="mt-3 space-y-2 rounded-2xl bg-sunken p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (how they sign in)" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink/70">Spending cap per order (₦)</span>
            <Input inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
          </label>
          <Button
            className="text-sm"
            busy={busy}
            onClick={() => run(() => api.editUser(detail.id, {
              full_name: name, phone, email,
              basket_cap_naira: cap.trim() === "" ? undefined : Number(cap),
            }), "Details saved.")}
          >
            Save changes
          </Button>
        </div>
      )}

      {panel === "market" && (
        <div className="mt-3 space-y-2 rounded-2xl bg-sunken p-3">
          <select
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-ink"
          >
            <option value="">Choose a market…</option>
            {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Button className="text-sm" busy={busy} disabled={!marketId} onClick={() => run(() => api.moveAgentMarket(detail.id, marketId), "Agent moved.")}>
            Move agent
          </Button>
        </div>
      )}

      {panel === "role" && (
        <div className="mt-3 space-y-2 rounded-2xl bg-red-50 p-3">
          <p className="text-sm text-ink/80">
            They become an ordinary customer again; their history stays. This is refused while they still have work in progress.
          </p>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (required, kept in the audit log)" />
          <Button className="!bg-red-600 text-sm hover:!bg-red-700" busy={busy} disabled={note.trim().length < 3}
            onClick={() => run(() => api.endStaffRole(detail.id, note.trim()), "Role ended.")}>
            Stand down
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {done && <p className="mt-2 text-sm font-semibold text-brand-green">{done}</p>}
    </div>
  );
}
