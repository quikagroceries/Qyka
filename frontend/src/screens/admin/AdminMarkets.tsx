'use client';

import StatTile from "@/components/ui/StatTile";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import { CardSkeleton } from "@/components/ui/Skeleton";
import MarketArt from "@/components/shop/MarketArt";
import { marketTone } from "@/lib/vendorVisuals";
import { coverImageForMarket } from "@/lib/markets";
import { LOW_FLOAT_BALANCE } from "@/lib/adminUtils";

const STATUS_OPTIONS = [
  { value: "coming_soon", label: "Coming soon" },
  { value: "pilot", label: "Pilot" },
  { value: "live", label: "Live" },
];
const STATUS_PILL = {
  coming_soon: "bg-brand-orange/20 text-brand-orange-dark",
  pilot: "bg-brand-green/15 text-brand-green",
  live: "bg-brand-green/15 text-brand-green",
};
const STATUS_LABEL = { coming_soon: "Coming soon", pilot: "Pilot", live: "Live" };
const CATEGORIES = ["produce", "provisions", "protein", "spices", "fish", "grains", "household"];

// "08:00:00" (API) <-> "08:00" (<input type="time">)
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");

// Shared by create and edit - same fields either way, just prefilled and
// pointed at a different submit handler when editing. The slug is set once
// at creation and shown read-only afterwards (the backend refuses changes).
function MarketForm({ initial, onSubmit, onCancel, busy, error }: any) {
  const [name, setName] = useState(initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [status, setStatus] = useState(initial?.status || "coming_soon");
  const [categories, setCategories] = useState<string[]>(initial?.categories || []);
  const [imageUrl, setImageUrl] = useState(initial?.image_url || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [venueType, setVenueType] = useState(initial?.venue_type || "local_market");
  const [city, setCity] = useState(initial?.city || "");
  const [state, setState] = useState(initial?.state || "");
  const [openingTime, setOpeningTime] = useState(hhmm(initial?.opening_time) || "08:00");
  const [closingTime, setClosingTime] = useState(hhmm(initial?.closing_time) || "20:00");
  const [latitude, setLatitude] = useState(initial?.latitude ?? "");
  const [longitude, setLongitude] = useState(initial?.longitude ?? "");

  function toggleCategory(c: string) {
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }

  async function uploadImage(file?: File) {
    if (!file) return;
    setUploadError(""); setUploading(true);
    try {
      setImageUrl(await api.uploadMarketImage(file));
    } catch (e: any) {
      setUploadError("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    onSubmit({
      name: name.trim(),
      ...(initial ? {} : slug.trim() ? { slug: slug.trim().toLowerCase() } : {}),
      description: description.trim(),
      status,
      categories,
      image_url: imageUrl || "",
      venue_type: venueType,
      city: city.trim(),
      state: state.trim(),
      opening_time: openingTime,
      closing_time: closingTime,
      latitude: latitude === "" ? null : Number(latitude),
      longitude: longitude === "" ? null : Number(longitude),
    });
  }

  const label = "mb-1 block text-xs font-semibold text-muted";

  return (
    <Card className="border-2 border-brand-orange">
      <p className="mb-3 font-bold text-ink">{initial ? "Edit market" : "New market"}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input placeholder="Name (e.g. Mile 12 Market)" value={name} onChange={(e) => setName(e.target.value)} className="sm:col-span-2" />
        <div className="sm:col-span-2">
          {initial ? (
            <p className="text-xs text-muted">
              Link: <span className="font-mono">/markets/{initial.slug}</span> — fixed, so links and the website keep working after a rename.
            </p>
          ) : (
            <>
              <Input placeholder="Slug (optional, e.g. mile-12 — made from the name if blank)" value={slug} onChange={(e) => setSlug(e.target.value)} />
              <p className="mt-1 text-xs text-faint">Can&apos;t be changed after the market is created.</p>
            </>
          )}
        </div>
        <textarea
          placeholder="Short description shown on the website"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-2xl border border-line-strong bg-surface px-4 py-3 text-base text-ink placeholder:text-faint focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/40 sm:col-span-2"
        />
        <label className="block">
          <span className={label}>Status</span>
          <Input as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Input>
          <span className="mt-1 block text-xs text-faint">
            {status === "coming_soon" ? "Listed on the site, but no orders yet." : "Taking orders."}
          </span>
        </label>
        <label className="block">
          <span className={label}>Venue type</span>
          <Input as="select" value={venueType} onChange={(e) => setVenueType(e.target.value)}>
            <option value="local_market">Open-air market</option>
            <option value="supermarket">Supermarket</option>
          </Input>
        </label>
        <div className="sm:col-span-2">
          <span className={label}>Categories</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <Chip key={c} size="sm" selected={categories.includes(c)} onClick={() => toggleCategory(c)} className="capitalize">
                {c}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of a fresh upload
            <img src={imageUrl} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
          )}
          <label className="flex-1">
            <span className={label}>Cover image</span>
            <input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadImage(e.target.files?.[0])} className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-sunken file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink" />
          </label>
          {imageUrl && <Button variant="neutral" onClick={() => setImageUrl("")} className="shrink-0 text-sm">Remove</Button>}
        </div>
        {(uploading || uploadError) && (
          <p className={"text-xs sm:col-span-2 " + (uploadError ? "text-red-600" : "text-muted")}>{uploadError || "Uploading…"}</p>
        )}
        <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
        <label className="block">
          <span className={label}>Opens (local time)</span>
          <Input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>Closes (local time)</span>
          <Input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
        </label>
        <Input placeholder="Latitude (optional)" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        <Input placeholder="Longitude (optional)" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="neutral" onClick={onCancel} disabled={busy} className="flex-1">Cancel</Button>
        <Button onClick={submit} busy={busy} disabled={uploading || !name.trim() || !city.trim() || !state.trim()} className="flex-1">
          {initial ? "Save changes" : "Create market"}
        </Button>
      </div>
    </Card>
  );
}

function AdminMarkets() {
  const [markets, setMarkets] = useState<any>(null);
  const [floatByMarket, setFloatByMarket] = useState<any>({});
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const list = await api.getAllMarkets();
      setMarkets(list);
      setError("");
      const balances = await Promise.all(
        list.map((m) => api.floatBalance(m.id).catch(() => ({ balance: null })))
      );
      const map = {};
      list.forEach((m, i) => { map[m.id] = balances[i].balance; });
      setFloatByMarket(map);
    } catch (e) {
      setError("Could not load markets. (" + e.message + ")");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(body) {
    setFormError(""); setBusy(true);
    try {
      await api.createMarket(body);
      setCreating(false);
      await refresh();
    } catch (e) {
      setFormError("Could not create market: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(id, body) {
    setFormError(""); setBusy(true);
    try {
      await api.updateMarket(id, body);
      setEditingId(null);
      await refresh();
    } catch (e) {
      setFormError("Could not save changes: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(market) {
    setError(""); setBusy(true);
    try {
      await api.updateMarket(market.id, { is_active: !market.is_active });
      await refresh();
    } catch (e) {
      setError("Could not update market: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        icon="store"
        section="Operations"
        title="Markets"
        description="Where agents shop — this is what sets up a pilot market."
        actions={
          !creating ? (
            <Button onClick={() => setCreating(true)} className="shrink-0">
              <Icon name="plus" className="h-4 w-4" /> New market
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Markets" value={markets ? markets.length : "—"} />
          <StatTile label="Active" value={markets ? markets.filter((m) => m.is_active).length : "—"} tone="green" />
          <StatTile label="Inactive" value={markets ? markets.filter((m) => !m.is_active).length : "—"} />
        </div>
      </AdminPageHeader>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {creating && (
        <div className="mb-4">
          <MarketForm
            onSubmit={handleCreate}
            onCancel={() => { setCreating(false); setFormError(""); }}
            busy={busy}
            error={formError}
          />
        </div>
      )}

      {markets === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : markets.length === 0 && !creating ? (
        <EmptyState icon="store" title="No markets yet" subtitle="Create one to start assigning agents and orders." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) =>
            editingId === m.id ? (
              // The editor gets the whole row - too many fields for one card column.
              <div key={m.id} className="md:col-span-2 lg:col-span-3">
              <MarketForm
                initial={m}
                onSubmit={(body) => handleUpdate(m.id, body)}
                onCancel={() => { setEditingId(null); setFormError(""); }}
                busy={busy}
                error={formError}
              />
              </div>
            ) : (
              <div
                key={m.id}
                className={
                  "overflow-hidden rounded-3xl border border-line bg-surface shadow-sm " +
                  (m.is_active ? "" : "opacity-60")
                }
              >
                <div className="relative aspect-[16/9]">
                  <MarketArt
                    tone={marketTone(m.name, m.city)}
                    title={m.name}
                    image={coverImageForMarket(m)}
                    className="h-full w-full"
                  />
                  {!m.is_active && (
                    <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-bold text-muted shadow-sm">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-bold text-ink">{m.name}</div>
                    <span className={"shrink-0 rounded-full px-2 py-0.5 text-xs font-bold " + (STATUS_PILL[m.status] || "bg-sunken text-muted")}>
                      {STATUS_LABEL[m.status] || m.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted">{m.city}, {m.state} · opens {hhmm(m.opening_time)}–{hhmm(m.closing_time)}</div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-muted">Float balance</span>
                    <span className={
                      "font-bold " +
                      (floatByMarket[m.id] != null && Number(floatByMarket[m.id]) < LOW_FLOAT_BALANCE
                        ? "text-red-600" : "text-ink")
                    }>
                      {floatByMarket[m.id] != null ? `₦${floatByMarket[m.id]}` : "—"}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button variant="neutral" onClick={() => { setEditingId(m.id); setFormError(""); }} className="flex-1 text-sm">
                      Edit
                    </Button>
                    <Button variant="neutral" onClick={() => handleToggleActive(m)} disabled={busy} className="flex-1 text-sm">
                      {m.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default AdminMarkets;
