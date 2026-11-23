"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { TextField, TextAreaField, SelectField, DateField } from "@/components/rider/FormField";
import UploadField from "@/components/rider/UploadField";
import SelfieCapture from "@/components/rider/SelfieCapture";
import { ID_DOC_TYPES, type RiderApplicationData } from "@/components/rider/riderFormTypes";

// Section A — Personal Identity & Legal Verification.
function StepIdentity({
  data,
  update,
  errors,
}: {
  data: RiderApplicationData;
  update: (patch: Partial<RiderApplicationData>) => void;
  errors: Record<string, string>;
}) {
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState("");

  function dropPin() {
    if (!navigator.geolocation) {
      setGeoError("Location isn't available on this device/browser.");
      return;
    }
    setGeoError("");
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update({ geoLat: pos.coords.latitude.toFixed(6), geoLng: pos.coords.longitude.toFixed(6) });
        setGeoBusy(false);
      },
      () => {
        setGeoError("Couldn't get your location. Check permissions and try again.");
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-5">
      <TextField
        id="fullName" label="Full legal name" required hint="Must match your government ID exactly."
        value={data.fullName} onChange={(e: any) => update({ fullName: e.target.value })} error={errors.fullName}
      />
      <TextField
        id="phone" label="Phone number" type="tel" required hint="We'll text a code here to confirm it's really you, at the end."
        value={data.phone} onChange={(e: any) => update({ phone: e.target.value })} error={errors.phone}
      />
      <DateField
        id="dob" label="Date of birth" required hint="You must be 18 or older."
        value={data.dob} onChange={(e) => update({ dob: e.target.value })} error={errors.dob}
        toYear={new Date().getFullYear() - 18} fromYear={new Date().getFullYear() - 90}
        disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
      />
      <TextAreaField
        id="address" label="Residential address" required hint="Proof of address will be requested."
        value={data.address} onChange={(e: any) => update({ address: e.target.value })} error={errors.address}
      />
      <div>
        <label className="mb-1 block text-sm font-semibold text-ink">Pin your address on the map</label>
        <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-canvas p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunken text-brand-orange-dark">
            <Icon name="pin" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 text-sm text-muted">
            {data.geoLat && data.geoLng ? (
              <span className="font-semibold text-ink">{data.geoLat}, {data.geoLng}</span>
            ) : (
              "No pin dropped yet."
            )}
          </div>
          <button
            type="button"
            onClick={dropPin}
            disabled={geoBusy}
            className="shrink-0 rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-[#1A1A1A] hover:bg-brand-orange-dark disabled:opacity-60"
          >
            {geoBusy ? "Locating…" : "Drop pin"}
          </button>
        </div>
        {geoError && <p className="mt-1 text-xs font-semibold text-red-600">{geoError}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          id="idDocType" label="Government-issued ID type" required options={ID_DOC_TYPES}
          value={data.idDocType} onChange={(e: any) => update({ idDocType: e.target.value })} error={errors.idDocType}
        />
        <TextField
          id="idDocNumber" label="ID document number" required
          value={data.idDocNumber} onChange={(e: any) => update({ idDocNumber: e.target.value })} error={errors.idDocNumber}
        />
      </div>
      <DateField
        id="idDocExpiry" label="ID expiry date (if applicable)"
        value={data.idDocExpiry} onChange={(e) => update({ idDocExpiry: e.target.value })}
        fromYear={new Date().getFullYear()} toYear={new Date().getFullYear() + 15}
      />
      <UploadField
        id="idDocFile" label="Government ID copy" required
        value={data.idDocFile} onChange={(f) => update({ idDocFile: f })} error={errors.idDocFile}
      />
      <SelfieCapture value={data.selfieFile} onChange={(f) => update({ selfieFile: f })} error={errors.selfieFile} />

      <div className="border-t border-dashed border-line pt-5">
        <p className="mb-3 font-display text-base font-extrabold text-ink">Emergency contact</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="emergencyName" label="Full name" required
            value={data.emergencyName} onChange={(e: any) => update({ emergencyName: e.target.value })} error={errors.emergencyName}
          />
          <TextField
            id="emergencyRelationship" label="Relationship" required
            value={data.emergencyRelationship} onChange={(e: any) => update({ emergencyRelationship: e.target.value })} error={errors.emergencyRelationship}
          />
          <TextField
            id="emergencyPhone" label="Phone number" type="tel" required
            value={data.emergencyPhone} onChange={(e: any) => update({ emergencyPhone: e.target.value })} error={errors.emergencyPhone}
          />
          <TextField
            id="emergencyAddress" label="Verified physical address" required
            value={data.emergencyAddress} onChange={(e: any) => update({ emergencyAddress: e.target.value })} error={errors.emergencyAddress}
          />
        </div>
      </div>
    </div>
  );
}

export default StepIdentity;
