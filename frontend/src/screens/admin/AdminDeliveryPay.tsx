'use client';

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { naira } from "@/lib/orderMath";
import { errMsg } from "@/lib/hubUtils";
import StatTile from "@/components/ui/StatTile";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { CardSkeleton } from "@/components/ui/Skeleton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const money = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

// What's left of the customer's flat delivery fee once the rider and hub are
// paid. Said plainly, because a negative number means the company pays the
// difference out of its own margin on every order.
function MarginNote({ deliveryFee, rider, hub }: { deliveryFee: number; rider: number | null; hub: number | null }) {
  if (rider === null || hub === null) return null;
  const margin = deliveryFee - rider - hub;
  if (margin === 0) return <p className="text-sm text-muted">Exactly covered by the {naira(deliveryFee)} delivery fee.</p>;
  if (margin > 0) return <p className="text-sm text-brand-green">Qyka keeps {naira(margin)} of the {naira(deliveryFee)} delivery fee on each order.</p>;
  return (
    <p className="text-sm font-semibold text-red-600">
      Costs Qyka {naira(-margin)} on each order: more than the {naira(deliveryFee)} the customer pays for delivery.
    </p>
  );
}

function FeeEditor({ initial, deliveryFee, busy, saveLabel, onSave, onCancel }: any) {
  const [rider, setRider] = useState(String(Number(initial.rider_fee)));
  const [hub, setHub] = useState(String(Number(initial.hub_fee)));
  const r = money(rider);
  const h = money(hub);
  const invalid = r === null || h === null || r < 0 || h < 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/70">Rider earns (₦)</span>
          <Input inputMode="decimal" value={rider} onChange={(e) => setRider(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink/70">Hub earns (₦)</span>
          <Input inputMode="decimal" value={hub} onChange={(e) => setHub(e.target.value)} />
        </label>
      </div>
      <MarginNote deliveryFee={deliveryFee} rider={r} hub={h} />
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="neutral" className="text-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button className="text-sm" busy={busy} disabled={invalid} onClick={() => onSave({ rider_fee: rider.trim(), hub_fee: hub.trim() })}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

export default function AdminDeliveryPay() {
  const [data, setData] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function refresh() {
    try {
      const [fees, marketList] = await Promise.all([api.getDeliveryFees(), api.getAllMarkets()]);
      setData(fees);
      setMarkets(marketList);
      setError("");
    } catch (e) {
      setError("Could not load delivery pay. " + errMsg(e));
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function run(key: string, fn: () => Promise<any>, message: string) {
    setError("");
    setSaved("");
    setBusy(key);
    try {
      await fn();
      await refresh();
      setSaved(message);
      setEditing(null);
    } catch (e) {
      setError("Could not save. " + errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const deliveryFee = data ? Number(data.delivery_fee) : 0;
  const overrides: Record<string, any> = {};
  (data?.markets || []).forEach((m: any) => (overrides[m.market_id] = m));

  return (
    <div>
      <AdminPageHeader
        icon="send"
        section="Money"
        title="Delivery pay"
        description="What a rider and a hub earn for each delivered order. Fixed amounts, paid once the customer confirms they received it."
      >
        {data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Customer pays for delivery" value={naira(deliveryFee)} />
            <StatTile label="Rider earns (default)" value={naira(data.default.rider_fee)} />
            <StatTile label="Hub earns (default)" value={naira(data.default.hub_fee)} />
            <StatTile label="Market overrides" value={data.markets.length} />
          </div>
        )}
      </AdminPageHeader>

      <p className="mb-4 rounded-2xl bg-sunken px-4 py-3 text-sm text-muted">
        Changes apply to orders created from now on. An order already placed keeps the pay it was created with.
      </p>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="mb-4 rounded-lg bg-brand-green/10 px-3 py-2 text-sm font-semibold text-brand-green">{saved}</p>}

      {!data ? (
        <CardSkeleton />
      ) : (
        <>
          <SectionHeader
            icon="trending"
            title="Default"
            subtitle={data.default.is_built_in ? "Nothing saved yet - these are the built-in amounts." : "Used in every market without its own override."}
            className="mb-3"
          />
          <Card className="mb-8">
            <FeeEditor
              key={`${data.default.rider_fee}-${data.default.hub_fee}`}
              initial={data.default}
              deliveryFee={deliveryFee}
              busy={busy === "default"}
              saveLabel="Save default"
              onSave={(b) => run("default", () => api.setDefaultDeliveryFees(b), "Default pay saved.")}
            />
          </Card>

          <SectionHeader icon="store" title="By market" subtitle="Pay more (or less) in a particular market." className="mb-3" />
          <div className="space-y-2">
            {markets.map((m) => {
              const o = overrides[m.id];
              const eff = o || data.default;
              const isEditing = editing === m.id;
              return (
                <Card key={m.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{m.name}</p>
                      <p className="text-sm text-muted">
                        Rider {naira(eff.rider_fee)} · Hub {naira(eff.hub_fee)}
                        {o ? (
                          <span className="ml-2 rounded-full bg-brand-orange/15 px-2 py-0.5 text-xs font-bold text-brand-orange-dark">Custom</span>
                        ) : (
                          <span className="ml-2 text-xs text-faint">Default</span>
                        )}
                      </p>
                    </div>
                    {!isEditing && (
                      <div className="flex gap-2">
                        <Button variant="neutral" className="text-sm" onClick={() => setEditing(m.id)}>
                          {o ? "Change" : "Set custom pay"}
                        </Button>
                        {o && (
                          <Button
                            variant="neutral"
                            className="text-sm"
                            busy={busy === m.id}
                            onClick={() => run(m.id, () => api.clearMarketDeliveryFees(m.id), `${m.name} now follows the default.`)}
                          >
                            Use default
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <div className="mt-4 border-t border-line pt-4">
                      <FeeEditor
                        initial={eff}
                        deliveryFee={deliveryFee}
                        busy={busy === m.id}
                        saveLabel="Save for this market"
                        onCancel={() => setEditing(null)}
                        onSave={(b) => run(m.id, () => api.setMarketDeliveryFees(m.id, b), `${m.name} pay saved.`)}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
