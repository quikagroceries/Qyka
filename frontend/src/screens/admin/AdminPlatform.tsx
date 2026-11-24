'use client';

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errMsg } from "@/lib/hubUtils";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import SectionHeader from "@/components/ui/SectionHeader";
import StatTile from "@/components/ui/StatTile";
import { CardSkeleton } from "@/components/ui/Skeleton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const GROUP_ORDER = ["Emergency", "Pricing", "Safety limits", "Sign-in codes"];
const GROUP_ICON: Record<string, string> = { Emergency: "alert", Pricing: "wallet", "Safety limits": "shield", "Sign-in codes": "phone" };
const GROUP_NOTE: Record<string, string> = {
  Emergency: "Use when something is wrong and you need to stop it now.",
  Pricing: "Applies to orders created from now on. An order already placed keeps the pricing it was created with.",
  "Safety limits": "Applies straight away.",
  "Sign-in codes": "Applies straight away.",
};

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-brand-green/10 text-brand-green",
  warn: "bg-red-50 text-red-700",
  off: "bg-sunken text-muted",
};
const STATUS_LABEL: Record<string, string> = { ok: "OK", warn: "Needs attention", off: "Not set up" };

function SystemStatus() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.getSystemStatus().then(setData).catch((e) => setError("Could not check the system. " + errMsg(e)));
  }, []);
  return (
    <>
      <SectionHeader
        icon="check"
        title="System status"
        subtitle={data ? `Environment: ${data.environment}${data.migration ? ` · database version ${data.migration}` : ""}` : "Is everything the app depends on switched on?"}
        className="mb-3"
      />
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {!data && !error ? (
        <CardSkeleton />
      ) : data ? (
        <div className="mb-8 grid gap-2 sm:grid-cols-2">
          {data.checks.map((c: any) => (
            <Card key={c.key} className="flex items-center justify-between gap-3 !p-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{c.label}</p>
                <p className="text-sm text-muted">{c.detail}</p>
              </div>
              <span className={"shrink-0 rounded-full px-2.5 py-1 text-xs font-bold " + STATUS_STYLE[c.status]}>
                {STATUS_LABEL[c.status]}
              </span>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}

function SettingRow({ s, onChanged }: { s: any; onChanged: (rows: any[]) => void }) {
  const isBool = s.kind === "bool";
  const [draft, setDraft] = useState<string>(isBool ? String(s.value) : String(s.value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Follow the server after a save/reset.
  useEffect(() => { setDraft(String(s.value)); }, [s.value]);

  const dirty = draft !== String(s.value);

  async function save(value: string | boolean) {
    setError(""); setBusy(true);
    try {
      onChanged(await api.setPlatformSetting(s.key, value));
      setConfirming(false);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setError(""); setBusy(true);
    try {
      await api.resetPlatformSetting(s.key);
      onChanged(await api.getPlatformSettings().then((all: any[]) => all.filter((x) => x.key === s.key)));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">
            {s.label}
            {!s.is_default && (
              <span className="ml-2 rounded-full bg-brand-orange/15 px-2 py-0.5 text-xs font-bold text-brand-orange-dark">Changed</span>
            )}
          </p>
          <p className="text-sm text-muted">{s.help}</p>
        </div>

        {isBool ? (
          <div className="shrink-0">
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">{s.value ? "Re-open orders?" : "Stop new orders?"}</span>
                <Button variant="neutral" className="text-sm" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
                <Button className="text-sm" busy={busy} onClick={() => save(!s.value)}>Yes</Button>
              </div>
            ) : (
              <Button variant={s.value ? "primary" : "neutral"} className="text-sm" onClick={() => setConfirming(true)}>
                {s.value ? "Paused — re-open" : "Pause new orders"}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {s.kind === "text" ? (
              <Input value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); }} className="w-72 max-w-full" />
            ) : (
              <div className="flex items-center gap-1.5">
                {s.unit === "₦" && <span className="text-muted">₦</span>}
                <Input inputMode="decimal" value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); }} className="w-28 text-right" />
                {s.unit && s.unit !== "₦" && <span className="text-sm text-muted">{s.unit}</span>}
              </div>
            )}
            <Button className="text-sm" busy={busy} disabled={!dirty || draft.trim() === ""} onClick={() => save(draft.trim())}>
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
        <span>
          Built-in default: {isBool ? (s.default ? "paused" : "open") : `${s.unit === "₦" ? "₦" : ""}${s.default}${s.unit && s.unit !== "₦" ? " " + s.unit : ""}`}
          {s.min !== null && s.max !== null && !isBool && s.kind !== "text" ? ` · allowed ${s.min}–${s.max}` : ""}
        </span>
        {!s.is_default && (
          <button type="button" onClick={reset} disabled={busy} className="font-semibold text-brand-orange-dark hover:underline disabled:opacity-50">
            Reset to default
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

export default function AdminPlatform() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getPlatformSettings().then(setRows).catch((e) => setError("Could not load settings. " + errMsg(e)));
  }, []);

  const patch = (changed: any[]) =>
    setRows((cur) => (cur || []).map((r) => changed.find((c) => c.key === r.key) || r));

  const paused = rows?.find((r) => r.key === "orders_paused")?.value === true;
  const changedCount = rows ? rows.filter((r) => !r.is_default).length : 0;

  return (
    <div>
      <AdminPageHeader
        icon="star"
        section="Owner"
        title="Platform"
        description="The business rules and safety limits that used to need a developer. Every change is recorded in the audit log."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Settings" value={rows?.length ?? "—"} />
          <StatTile label="Changed from default" value={rows ? changedCount : "—"} />
          <StatTile label="New orders" value={rows ? (paused ? "Paused" : "Open") : "—"} tone={paused ? "ink" : "green"} />
        </div>
      </AdminPageHeader>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {paused && (
        <p className="mb-4 rounded-2xl bg-brand-orange/15 px-4 py-3 text-sm font-semibold text-ink">
          New orders are paused. Customers can&apos;t start an order; ones already in progress carry on.
        </p>
      )}

      <SystemStatus />

      {!rows && !error && <CardSkeleton />}
      {rows &&
        GROUP_ORDER.filter((g) => rows.some((r) => r.group === g)).map((g) => (
          <div key={g} className="mb-8">
            <SectionHeader icon={GROUP_ICON[g]} title={g} subtitle={GROUP_NOTE[g]} className="mb-3" />
            <div className="space-y-2">
              {rows.filter((r) => r.group === g).map((s) => (
                <SettingRow key={s.key} s={s} onChanged={patch} />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
