"use client";

import { TextField, SelectField } from "@/components/rider/FormField";
import { NIGERIAN_BANKS, type RiderApplicationData } from "@/components/rider/riderFormTypes";

const BANK_OPTIONS = NIGERIAN_BANKS.map((b) => ({ value: b, label: b }));

// Section E — Banking, Payout & Financial Security.
function StepBanking({
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
      <TextField
        id="accountName" label="Account name" required hint="Must match your verified legal name on your ID."
        value={data.accountName} onChange={(e: any) => update({ accountName: e.target.value })} error={errors.accountName}
      />
      <SelectField
        id="bankName" label="Bank name" required options={BANK_OPTIONS}
        value={data.bankName} onChange={(e: any) => update({ bankName: e.target.value })} error={errors.bankName}
      />
      <TextField
        id="accountNumber" label="Account number (NUBAN)" required inputMode="numeric" maxLength={10}
        hint="10 digits."
        value={data.accountNumber}
        onChange={(e: any) => update({ accountNumber: e.target.value.replace(/\D/g, "").slice(0, 10) })}
        error={errors.accountNumber}
      />

      <label className="flex items-start gap-3 rounded-2xl border border-line-strong bg-canvas p-4 text-sm text-ink">
        <input
          type="checkbox"
          checked={data.acceptsDepositAuthorization}
          onChange={(e) => update({ acceptsDepositAuthorization: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong text-brand-orange accent-brand-orange"
        />
        <span>
          I authorize Qyka to maintain a minimum operational float/collateral balance from my wallet as security
          for cash-on-delivery (COD) order safety. <span className="text-brand-orange-dark">*</span>
        </span>
      </label>
      {errors.acceptsDepositAuthorization && (
        <p className="text-xs font-semibold text-red-600">{errors.acceptsDepositAuthorization}</p>
      )}
    </div>
  );
}

export default StepBanking;
