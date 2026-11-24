'use client';

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

// The agent's step once the balance is paid: carry the goods to the hub in
// the market and drop them there. The shopkeeper takes it from here - checks
// what arrived, readies it, and hands it to a rider. Photos are optional and
// best-effort, so a weak signal at the market never blocks the drop.
function DropAtHubPanel({ order, onDropped }: any) {
  const [hubs, setHubs] = useState<any[] | null>(null);
  const [hubId, setHubId] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>(order.packing_photos || []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getHubsForMarket(order.market_id)
      .then((list) => {
        setHubs(list);
        if (list.length === 1) setHubId(list[0].id);
      })
      .catch((e) => {
        setHubs([]);
        setError("Could not load the hubs for this market. " + e.message);
      });
  }, [order.market_id]);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await api.uploadPackingPhoto(file);
      setPhotos((cur) => [...cur, url]);
      // Best-effort attach - never blocks the drop below.
      await api.addPackingPhotos(order.id, [url]).catch(() => {});
    } catch (e2) {
      setError("Photo upload failed: " + e2.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDrop() {
    setError("");
    setBusy(true);
    try {
      await api.dropAtHub(order.id, hubId || undefined);
      onDropped();
    } catch (e2) {
      setError("Could not record the drop-off: " + e2.message);
    } finally {
      setBusy(false);
    }
  }

  const noHub = hubs !== null && hubs.length === 0;

  return (
    <Card className="border-2 border-brand-orange">
      <p className="mb-1 text-lg font-bold text-ink">Take it to the hub</p>
      <p className="mb-4 text-sm text-muted">
        Balance paid. Carry everything to the hub in the market and drop it with the shopkeeper — they check it in and
        hand it to a rider.
      </p>

      {hubs && hubs.length > 1 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-semibold text-ink/80">Which hub are you dropping at?</p>
          {hubs.map((h) => (
            <label
              key={h.id}
              className={
                "flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 " +
                (hubId === h.id ? "border-brand-orange bg-brand-orange/10" : "border-line")
              }
            >
              <input
                type="radio"
                name="hub"
                checked={hubId === h.id}
                onChange={() => setHubId(h.id)}
                className="accent-brand-orange"
              />
              <span className="font-semibold text-ink">{h.name}</span>
            </label>
          ))}
        </div>
      )}
      {hubs && hubs.length === 1 && (
        <p className="mb-4 rounded-2xl bg-sunken px-4 py-3 text-sm font-semibold text-ink">
          Drop at: {hubs[0].name}
        </p>
      )}
      {noHub && !error && (
        <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          This market doesn&apos;t have a hub yet, so there&apos;s nowhere to drop this order. Contact support.
        </p>
      )}

      <p className="mb-2 text-sm font-semibold text-ink/80">Photo of the goods (optional)</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary thumbnails
          <img key={src + i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-strong text-faint disabled:opacity-50"
        >
          <Icon name="camera" className="h-5 w-5" />
          <span className="text-[10px] font-semibold">{uploading ? "…" : "Add"}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <Button onClick={handleDrop} busy={busy} disabled={!hubId || uploading} fullWidth className="text-lg">
        I&apos;ve dropped it at the hub
      </Button>
      {hubs && hubs.length > 1 && !hubId && (
        <p className="mt-2 text-center text-sm text-muted">Pick the hub first.</p>
      )}
    </Card>
  );
}

export default DropAtHubPanel;
