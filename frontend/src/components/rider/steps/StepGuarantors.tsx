"use client";

import { TextField, SelectField } from "@/components/rider/FormField";
import UploadField from "@/components/rider/UploadField";
import {
  GUARANTOR_RELATIONSHIPS,
  type GuarantorInfo,
  type RiderApplicationData,
} from "@/components/rider/riderFormTypes";

const RELATIONSHIP_OPTIONS = GUARANTOR_RELATIONSHIPS.map((r) => ({ value: r, label: r }));

function GuarantorFields({
  index,
  value,
  onChange,
  errors,
}: {
  index: 1 | 2;
  value: GuarantorInfo;
  onChange: (patch: Partial<GuarantorInfo>) => void;
  errors: Record<string, string>;
}) {
  const p = `guarantor${index}`;
  return (
    <div className="rounded-3xl border border-line bg-canvas p-5">
      <p className="mb-4 font-display text-base font-extrabold text-ink">Guarantor {index}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id={`${p}-fullName`} label="Full name" required
          value={value.fullName} onChange={(e: any) => onChange({ fullName: e.target.value })} error={errors[`${p}.fullName`]}
        />
        <SelectField
          id={`${p}-relationship`} label="Relationship" required options={RELATIONSHIP_OPTIONS}
          value={value.relationship} onChange={(e) => onChange({ relationship: e.target.value })}
          error={errors[`${p}.relationship`]}
        />
        <TextField
          id={`${p}-phone`} label="Verified phone number" type="tel" required
          value={value.phone} onChange={(e: any) => onChange({ phone: e.target.value })} error={errors[`${p}.phone`]}
        />
        <TextField
          id={`${p}-address`} label="Office / residential address" required
          value={value.address} onChange={(e: any) => onChange({ address: e.target.value })} error={errors[`${p}.address`]}
        />
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <UploadField
          id={`${p}-idFile`} label="Scanned copy of guarantor's ID" required accept="image/*,.pdf"
          value={value.idFile} onChange={(f) => onChange({ idFile: f })} error={errors[`${p}.idFile`]}
        />
        <UploadField
          id={`${p}-photoFile`} label="Guarantor's passport photograph" required
          value={value.photoFile} onChange={(f) => onChange({ photoFile: f })} error={errors[`${p}.photoFile`]}
        />
      </div>
    </div>
  );
}

// Section B — Guarantor & Background Vetting.
function StepGuarantors({
  data,
  update,
  errors,
}: {
  data: RiderApplicationData;
  update: (patch: Partial<RiderApplicationData>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Two independent guarantors are required to vet every rider and deter cargo theft — this protects you,
        the market agents, and the platform.
      </p>
      <GuarantorFields
        index={1}
        value={data.guarantor1}
        onChange={(patch) => update({ guarantor1: { ...data.guarantor1, ...patch } })}
        errors={errors}
      />
      <GuarantorFields
        index={2}
        value={data.guarantor2}
        onChange={(patch) => update({ guarantor2: { ...data.guarantor2, ...patch } })}
        errors={errors}
      />

      <div className="rounded-3xl border border-line bg-canvas p-5">
        <p className="mb-3 font-display text-base font-extrabold text-ink">Criminal background & declarations</p>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">
            Have you ever been convicted of any criminal offense related to theft, fraud, or violence?
            <span className="text-brand-orange-dark"> *</span>
          </p>
          <div className="flex gap-2">
            {(["no", "yes"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ hasCriminalConviction: v })}
                className={
                  "flex-1 rounded-full border px-3 py-2 text-sm font-bold capitalize transition " +
                  (data.hasCriminalConviction === v
                    ? "border-brand-orange bg-brand-orange text-[#1A1A1A]"
                    : "border-line-strong text-ink/60 hover:text-ink")
                }
              >
                {v}
              </button>
            ))}
          </div>
          {data.hasCriminalConviction === "yes" && (
            <p className="mt-2 rounded-xl bg-[#FBE7D5] px-3 py-2 text-xs font-semibold text-brand-orange-dark">
              A &quot;Yes&quot; answer triggers an immediate manual compliance review before your application can proceed.
            </p>
          )}
          {errors.hasCriminalConviction && (
            <p className="mt-1 text-xs font-semibold text-red-600">{errors.hasCriminalConviction}</p>
          )}
        </div>

        <label className="mt-4 flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={data.consentsToBackgroundCheck}
            onChange={(e) => update({ consentsToBackgroundCheck: e.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong text-brand-orange accent-brand-orange"
          />
          <span>
            I consent to Qyka running a security and reference background check on the information I&apos;ve
            provided. <span className="text-brand-orange-dark">*</span>
          </span>
        </label>
        {errors.consentsToBackgroundCheck && (
          <p className="mt-1 text-xs font-semibold text-red-600">{errors.consentsToBackgroundCheck}</p>
        )}
      </div>
    </div>
  );
}

export default StepGuarantors;
