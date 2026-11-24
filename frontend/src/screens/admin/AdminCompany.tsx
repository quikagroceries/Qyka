'use client';

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errMsg } from "@/lib/hubUtils";
import CompanyOverview from "@/components/company/CompanyOverview";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import SectionHeader from "@/components/ui/SectionHeader";

const EXPIRY = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "", label: "Never" },
];

const STATUS_STYLE: Record<string, string> = {
  live: "bg-brand-green/10 text-brand-green",
  revoked: "bg-red-50 text-red-700",
  expired: "bg-sunken text-muted",
};

function when(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

// A read-only link to the overview below, for investors: no login, nothing but
// the aggregate numbers, switched off the moment it's revoked.
function InvestorLinks() {
  const [links, setLinks] = useState<any[] | null>(null);
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState("30");
  const [financials, setFinancials] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState<{ url: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = () => api.listInvestorLinks().then(setLinks).catch((e) => setError("Could not load links. " + errMsg(e)));
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true); setCopied(false);
    try {
      const made = await api.createInvestorLink({
        label: label.trim(), expires_in_days: expiry ? Number(expiry) : null, include_financials: financials,
      });
      setFresh({ url: `${window.location.origin}/investors/${made.token}`, label: made.label });
      setLabel("");
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(""); setRevoking(id);
    try { await api.revokeInvestorLink(id); await load(); } catch (e) { setError(errMsg(e)); } finally { setRevoking(null); }
  }

  return (
    <div className="mt-10">
      <SectionHeader
        icon="send"
        title="Share with investors"
        subtitle="Make a link anyone can open to see this overview - no login, aggregate numbers only (no customer names, phone numbers or individual orders). You can switch it off at any time."
        className="mb-3"
      />
      <Card className="mb-4">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Who is it for? e.g. Seed round - November" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} required className="sm:col-span-2" />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink/70">Link works for</span>
            <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-ink">
              {EXPIRY.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-2xl border border-line px-4 py-3">
            <input type="checkbox" checked={financials} onChange={(e) => setFinancials(e.target.checked)} className="h-5 w-5 accent-brand-orange" />
            <span className="text-sm">
              <span className="block font-semibold text-ink">Include revenue</span>
              <span className="block text-muted">Untick to share volume and reliability only</span>
            </span>
          </label>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2"><Button type="submit" busy={busy} disabled={label.trim().length < 2}>Create link</Button></div>
        </form>

        {fresh && (
          <div className="mt-4 rounded-2xl bg-brand-green/10 p-4">
            <p className="text-sm font-semibold text-ink">Link for &ldquo;{fresh.label}&rdquo; is ready - copy it now.</p>
            <p className="mt-1 text-sm text-muted">It won&apos;t be shown again (only a scrambled version is kept). If you lose it, switch it off and make a new one.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded-xl bg-surface px-3 py-2 text-sm text-ink">{fresh.url}</code>
              <Button
                className="text-sm"
                onClick={async () => { await navigator.clipboard.writeText(fresh.url); setCopied(true); }}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {links && links.length > 0 && (
        <div className="space-y-2">
          {links.map((l) => (
            <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3 !p-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {l.label}
                  <span className={"ml-2 rounded-full px-2 py-0.5 text-xs font-bold capitalize " + STATUS_STYLE[l.status]}>{l.status}</span>
                </p>
                <p className="text-sm text-muted">
                  Made {when(l.created_at)} · {l.expires_at ? `expires ${when(l.expires_at)}` : "never expires"} · {l.include_financials ? "with revenue" : "volume only"}
                </p>
                <p className="text-xs text-faint">
                  Opened {l.view_count} time{l.view_count === 1 ? "" : "s"}{l.last_viewed_at ? ` · last ${when(l.last_viewed_at)}` : ""}
                </p>
              </div>
              {l.status === "live" && (
                <Button variant="neutral" className="text-sm !text-red-600" busy={revoking === l.id} onClick={() => revoke(l.id)}>
                  Switch off
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminCompany() {
  const [period, setPeriod] = useState("30");
  const [financials, setFinancials] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getCompanyOverview(Number(period), financials)
      .then((d) => { if (live) { setData(d); setError(""); } })
      .catch((e) => live && setError("Could not load the overview. " + errMsg(e)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [period, financials]);

  return (
    <div>
      <AdminPageHeader
        icon="chart"
        section="Owner"
        title="Company overview"
        description="The company's headline numbers, defined once and counted when an order is delivered. This is exactly what an investor link shows."
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/80">
            <input type="checkbox" checked={financials} onChange={(e) => setFinancials(e.target.checked)} className="h-4 w-4 accent-brand-orange" />
            Preview with revenue
          </label>
        }
      />
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <CompanyOverview data={data} loading={loading} period={period} onPeriod={setPeriod} />
      <InvestorLinks />
    </div>
  );
}
