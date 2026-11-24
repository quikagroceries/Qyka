'use client';

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { editableCopy, ROOT_LABELS } from "@/lib/content";
import { errMsg } from "@/lib/hubUtils";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FilterPills from "@/components/ui/FilterPills";
import SearchField from "@/components/ui/SearchField";
import StatTile from "@/components/ui/StatTile";
import { CardSkeleton } from "@/components/ui/Skeleton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const PAGE = 40;
const ORIGINAL = editableCopy();   // the wording the site ships with, key -> text

// "en.hero.variants.A.headline" -> "Hero › Variants › A › Headline"
function label(key: string) {
  return key.split(".").slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" › ");
}

function Row({ k, saved, onSaved }: { k: string; saved: string | undefined; onSaved: (key: string, value: string | null) => void }) {
  const current = saved ?? ORIGINAL[k];
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setDraft(current), [current]);

  async function run(fn: () => Promise<any>, then: () => void) {
    setError(""); setBusy(true);
    try { await fn(); then(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  const dirty = draft.trim() !== current;
  const long = ORIGINAL[k].length > 80 || draft.length > 80;

  return (
    <Card className="!p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{label(k)}</p>
        {saved !== undefined && (
          <span className="rounded-full bg-brand-orange/15 px-2 py-0.5 text-xs font-bold text-brand-orange-dark">Edited</span>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(""); }}
        rows={long ? 3 : 1}
        maxLength={2000}
        className="w-full resize-y rounded-2xl border border-line bg-surface p-3 text-base text-ink outline-none focus:border-brand-orange"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button className="text-sm" busy={busy} disabled={!dirty || draft.trim() === ""} onClick={() => run(() => api.setContent(k, draft.trim()), () => onSaved(k, draft.trim()))}>
            Save
          </Button>
          {saved !== undefined && (
            <Button variant="neutral" className="text-sm" busy={busy} onClick={() => run(() => api.resetContent(k), () => onSaved(k, null))}>
              Back to original
            </Button>
          )}
        </div>
        {saved !== undefined && <p className="max-w-md truncate text-xs text-faint" title={ORIGINAL[k]}>Original: {ORIGINAL[k]}</p>}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

export default function AdminContent() {
  const [overrides, setOverrides] = useState<Record<string, string> | null>(null);
  const [root, setRoot] = useState("en");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getContentOverrides()
      .then((rows: any[]) => setOverrides(Object.fromEntries(rows.map((r) => [r.key, r.value]))))
      .catch((e) => setError("Could not load the saved wording. " + errMsg(e)));
  }, []);

  const keys = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.keys(ORIGINAL).filter((k) => {
      if (!k.startsWith(root + ".")) return false;
      if (!q) return true;
      return k.toLowerCase().includes(q) || ORIGINAL[k].toLowerCase().includes(q) || (overrides?.[k] || "").toLowerCase().includes(q);
    });
  }, [root, query, overrides]);

  useEffect(() => setShown(PAGE), [root, query]);
  const editedCount = overrides ? Object.keys(overrides).length : 0;

  function onSaved(key: string, value: string | null) {
    setOverrides((cur) => {
      const next = { ...(cur || {}) };
      if (value === null) delete next[key]; else next[key] = value;
      return next;
    });
  }

  return (
    <div>
      <AdminPageHeader
        icon="chat"
        section="Owner"
        title="Website text"
        description="Reword the public website - headlines, FAQs, help answers - without a developer. Changes go live within a minute. Plain text only: links and prices can't be changed here."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Editable pieces" value={Object.keys(ORIGINAL).length} />
          <StatTile label="Reworded" value={overrides ? editedCount : "—"} />
        </div>
      </AdminPageHeader>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <FilterPills
        options={Object.entries(ROOT_LABELS).map(([key, text]) => ({ key, label: text }))}
        value={root}
        onChange={setRoot}
      />
      <div className="mb-4">
        <SearchField value={query} onChange={setQuery} placeholder="Find some wording…" />
      </div>

      {!overrides && !error ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : keys.length === 0 ? (
        <EmptyState icon="search" title="Nothing matches" subtitle="Try a different word, or another part of the site." />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {keys.length} piece{keys.length === 1 ? "" : "s"} of wording{query ? " match" : ""}.
            {root === "pcm" && " The Pidgin is a draft - have a native speaker review it."}
          </p>
          <div className="space-y-2">
            {keys.slice(0, shown).map((k) => (
              <Row key={k} k={k} saved={overrides?.[k]} onSaved={onSaved} />
            ))}
          </div>
          {keys.length > shown && (
            <div className="mt-4 text-center">
              <Button variant="neutral" onClick={() => setShown((n) => n + PAGE)}>Show more ({keys.length - shown} left)</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
