"use client";

import { useState } from "react";
import { TextField, SelectField, DateField } from "@/components/rider/FormField";
import UploadField from "@/components/rider/UploadField";
import Icon from "@/components/ui/Icon";
import { LICENSE_CLASSES, type RiderApplicationData } from "@/components/rider/riderFormTypes";

// Section C — Driver's License & Regulatory Compliance.
// The "Automated API check" is a national-database lookup Qyka doesn't have
// yet — this simulates the call so the flow and states are real end to end;
// swap runVerification() for the live endpoint once it exists.
function StepLicense({
  data,
  update,
  errors,
}: {
  data: RiderApplicationData;
  update: (patch: Partial<RiderApplicationData>) => void;
  errors: Record<string, string>;
}) {
  const [checking, setChecking] = useState(false);

  function runVerification() {
    setChecking(true);
    update({ licenseVerified: false });
    setTimeout(() => {
      setChecking(false);
      update({ licenseVerified: true });
    }, 1400);
  }

  return (
    <div className="space-y-5">
      <SelectField
        id="licenseClass" label="Class of driver's license" required options={LICENSE_CLASSES}
        value={data.licenseClass} onChange={(e: any) => update({ licenseClass: e.target.value, licenseVerified: false })}
        error={errors.licenseClass}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="licenseNumber" label="License number" required
          value={data.licenseNumber} onChange={(e: any) => update({ licenseNumber: e.target.value, licenseVerified: false })}
          error={errors.licenseNumber}
        />
        <DateField
          id="licenseExpiry" label="Expiry date" required
          value={data.licenseExpiry} onChange={(e) => update({ licenseExpiry: e.target.value })}
          error={errors.licenseExpiry}
          fromYear={new Date().getFullYear()} toYear={new Date().getFullYear() + 15}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <UploadField
          id="licenseFrontFile" label="License (front)" required
          value={data.licenseFrontFile} onChange={(f) => update({ licenseFrontFile: f })} error={errors.licenseFrontFile}
        />
        <UploadField
          id="licenseBackFile" label="License (back)" required
          value={data.licenseBackFile} onChange={(f) => update({ licenseBackFile: f })} error={errors.licenseBackFile}
        />
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-canvas p-4">
        <span
          className={
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
            (data.licenseVerified ? "bg-brand-green text-white" : "bg-sunken text-faint")
          }
        >
          <Icon name="shield" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {data.licenseVerified ? (
            <span className="font-semibold text-brand-green">Verified against the national database.</span>
          ) : (
            <span className="text-muted">Not verified yet. Run a check against the national license database.</span>
          )}
        </div>
        <button
          type="button"
          onClick={runVerification}
          disabled={checking || !data.licenseNumber || !data.licenseClass}
          className="shrink-0 rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-[#1A1A1A] hover:bg-brand-orange-dark disabled:opacity-60"
        >
          {checking ? "Checking…" : data.licenseVerified ? "Re-check" : "Run check"}
        </button>
      </div>
    </div>
  );
}

export default StepLicense;
