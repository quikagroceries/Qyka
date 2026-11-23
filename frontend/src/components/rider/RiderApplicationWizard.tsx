"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import OtpInput from "@/components/auth/OtpInput";
import OtpResend from "@/components/auth/OtpResend";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import {
  EMPTY_RIDER_APPLICATION,
  RIDER_STEPS,
  type GuarantorInfo,
  type RiderApplicationData,
  type RiderStepKey,
} from "@/components/rider/riderFormTypes";
import StepIdentity from "@/components/rider/steps/StepIdentity";
import StepGuarantors from "@/components/rider/steps/StepGuarantors";
import StepLicense from "@/components/rider/steps/StepLicense";
import StepVehicle from "@/components/rider/steps/StepVehicle";
import StepBanking from "@/components/rider/steps/StepBanking";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Stepper({ current, furthest, onStepClick }: { current: number; furthest: number; onStepClick: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Application steps">
      {RIDER_STEPS.map((s, i) => {
        const done = i < furthest;
        const isCurrent = i === current;
        const clickable = i <= furthest && i !== current;
        const dot = (
          <span
            className={
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors " +
              (done
                ? "bg-brand-orange text-[#1A1A1A]"
                : isCurrent
                  ? "border-2 border-brand-orange bg-brand-orange/15 text-brand-orange-dark"
                  : "bg-sunken-2 text-faint")
            }
          >
            {done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
          </span>
        );
        const label = (
          <span className={"hidden text-xs font-bold sm:inline " + (isCurrent ? "text-ink" : done ? "text-muted" : "text-faint")}>
            {s.label}
          </span>
        );
        return (
          <li key={s.key} className={"flex items-center gap-2 " + (i < RIDER_STEPS.length - 1 ? "flex-1" : "")}>
            {clickable ? (
              <button type="button" onClick={() => onStepClick(i)} className="flex items-center gap-2 rounded-full transition hover:opacity-80" aria-label={`Go to ${s.label}`}>
                {dot}
                {label}
              </button>
            ) : (
              <span className="flex items-center gap-2" aria-current={isCurrent ? "step" : undefined}>
                {dot}
                {label}
              </span>
            )}
            {i < RIDER_STEPS.length - 1 && (
              <span className={"h-0.5 flex-1 rounded-full transition-colors duration-300 " + (done ? "bg-brand-orange" : "bg-line-strong")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function requireFields(data: Record<string, any>, keys: string[], errors: Record<string, string>) {
  for (const k of keys) {
    const v = data[k];
    const empty = v === "" || v === null || v === undefined || (typeof v === "boolean" && v === false);
    if (empty) errors[k] = "Required.";
  }
}

function validateGuarantor(g: GuarantorInfo, index: 1 | 2, errors: Record<string, string>) {
  const keys: (keyof GuarantorInfo)[] = ["fullName", "relationship", "phone", "address", "idFile", "photoFile"];
  for (const k of keys) {
    if (!g[k]) errors[`guarantor${index}.${k}`] = "Required.";
  }
}

function validateStep(step: RiderStepKey, data: RiderApplicationData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === "identity") {
    requireFields(data, [
      "fullName", "phone", "dob", "address", "idDocType", "idDocNumber", "idDocFile", "selfieFile",
      "emergencyName", "emergencyRelationship", "emergencyPhone", "emergencyAddress",
    ], errors);
  } else if (step === "guarantors") {
    validateGuarantor(data.guarantor1, 1, errors);
    validateGuarantor(data.guarantor2, 2, errors);
    if (!data.hasCriminalConviction) errors.hasCriminalConviction = "Please answer this question.";
    if (!data.consentsToBackgroundCheck) errors.consentsToBackgroundCheck = "Consent is required to continue.";
  } else if (step === "license") {
    requireFields(data, ["licenseClass", "licenseNumber", "licenseExpiry", "licenseFrontFile", "licenseBackFile"], errors);
  } else if (step === "vehicle") {
    requireFields(data, [
      "vehicleType", "vehicleMake", "vehicleModel", "vehicleYear", "vehicleColor", "vehiclePlate", "ownershipStatus",
      "registrationFile", "insuranceFile", "roadworthinessFile",
      "photoFront", "photoBack", "photoLeft", "photoRight", "photoEngineNumber", "photoStorageBox",
    ], errors);
    if (data.ownershipStatus === "rented" && !data.leaseAgreementFile) errors.leaseAgreementFile = "Required.";
  } else if (step === "banking") {
    requireFields(data, ["accountName", "bankName", "accountNumber", "acceptsDepositAuthorization"], errors);
    if (data.accountNumber && data.accountNumber.length !== 10) errors.accountNumber = "NUBAN must be 10 digits.";
  }
  return errors;
}

// "409: {"detail":"..."}" -> the backend's own sentence, when it has one.
function errorText(err: any) {
  const m = /^\d{3}: ([\s\S]*)$/.exec(err?.message || "");
  try {
    const detail = m && JSON.parse(m[1]).detail;
    if (typeof detail === "string") return detail;
  } catch {}
  return "Couldn't send your application. Check your connection and try again.";
}

// The full Sections A-E rider onboarding form, hosted as regular page
// content inside the standard AuthShell chrome (see app/become-rider) -
// not a popup. Name/phone/everything else is collected as plain fields
// first; the phone number is only verified by OTP at the very end, right
// before submitting, the same way Login/AuthSheet verify a number - so
// nobody is asked to "sign in" before they've even said who they are.
//
// File uploads stay local (File objects) - Qyka doesn't yet have dedicated
// endpoints for rider documents/guarantor records/license verification/NUBAN
// validation, so this collects everything and submits what the backend
// *does* support today (POST /agent-applications/public) plus a note
// flagging the rest for manual follow-up.
function RiderApplicationWizard() {
  const router = useRouter();
  const { handleLoggedIn, setUser } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [data, setData] = useState<RiderApplicationData>(EMPTY_RIDER_APPLICATION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"form" | "verify" | "done">("form");

  // Verify phase — the exact identifier/code pattern AuthSheet/Login use.
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [otpStep, setOtpStep] = useState<"send" | "code">("send");
  const [code, setCode] = useState("");
  const [otpSentKey, setOtpSentKey] = useState(0);
  const [fallbackAfter, setFallbackAfter] = useState(45);
  const [devOtp, setDevOtp] = useState("");
  const [sentChannel, setSentChannel] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const step = RIDER_STEPS[stepIndex];

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const remainingMs = expiresAt != null && now != null ? expiresAt - now : null;
  const codeExpired = remainingMs != null && remainingMs <= 0;

  function update(patch: Partial<RiderApplicationData>) {
    setData((d) => ({ ...d, ...patch }));
  }

  function goNext() {
    const stepErrors = validateStep(step.key, data);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    if (stepIndex === RIDER_STEPS.length - 1) {
      setPhase("verify");
      return;
    }
    setErrors({});
    setStepIndex((i) => {
      const next = i + 1;
      setFurthest((f) => Math.max(f, next));
      return next;
    });
  }

  function goBack() {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setErrors({});
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function jumpTo(i: number) {
    if (i > furthest) return;
    setErrors({});
    setStepIndex(i);
  }

  function handleResent(resendData: any) {
    if (resendData?.dev_otp) setDevOtp(resendData.dev_otp);
    setSentChannel(resendData?.channel || sentChannel);
    setExpiresAt(resendData?.expires_in_seconds ? Date.now() + resendData.expires_in_seconds * 1000 : null);
    setFallbackAfter(resendData?.fallback_after_seconds ?? 45);
    setOtpSentKey((k) => k + 1);
    setCode("");
  }

  async function sendCode() {
    setError("");
    setBusy(true);
    try {
      const resp = await api.requestOtp(data.phone, channel);
      if (resp?.dev_otp) setDevOtp(resp.dev_otp);
      setSentChannel(resp?.channel || channel);
      setExpiresAt(resp?.expires_in_seconds ? Date.now() + resp.expires_in_seconds * 1000 : null);
      setFallbackAfter(resp?.fallback_after_seconds ?? 45);
      setOtpSentKey((k) => k + 1);
      setCode("");
      setOtpStep("code");
    } catch {
      setError("Could not send a code. Check the number and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndSubmit() {
    setError("");
    setBusy(true);
    try {
      const verified = await api.verifyOtp(data.phone, code);
      handleLoggedIn(verified.access_token);
      let me = await api.me();
      if (!me?.full_name) me = await api.updateProfile({ full_name: data.fullName });
      setUser(me);

      await api.submitApplication({
        kind: "rider",
        full_name: data.fullName,
        phone: data.phone,
        area: data.address,
        vehicle: data.vehicleType,
        note:
          "Full rider onboarding form submitted (identity, guarantors, license, vehicle docs, banking). " +
          "Documents/photos were collected client-side and still need a backend upload path — follow up with the applicant directly.",
      });
      setPhase("done");
    } catch (err) {
      setError(errorText(err) || "Wrong or expired code. Request a new one.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green text-white">
          <Icon name="check" className="h-6 w-6" />
        </span>
        <p className="font-display text-xl font-extrabold text-ink">Application received</p>
        <p className="max-w-sm text-sm text-muted">
          We&apos;ll review your documents and guarantors, then call you on {data.phone} to take it from here.
        </p>
        <Button onClick={() => router.push("/for-riders")} className="mt-2">Done</Button>
      </div>
    );
  }

  if (phase === "verify") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setPhase("form")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M19 12H5M5 12l6-6M5 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to your application
        </button>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">Almost there</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Confirm your number.
        </h1>
        <p className="mt-3 text-muted">
          One last thing — we&apos;ll text {data.phone} a code to confirm it&apos;s really you before your application goes in.
        </p>

        <div className="mt-6 space-y-3">
          {otpStep === "send" && (
            <>
              <div className="flex gap-2">
                {([{ key: "sms", label: "SMS" }, { key: "whatsapp", label: "WhatsApp" }] as const).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setChannel(c.key)}
                    className={
                      "flex-1 rounded-full border px-3 py-2 text-sm font-bold transition " +
                      (channel === c.key
                        ? "border-brand-orange bg-brand-orange text-[#1A1A1A]"
                        : "border-line-strong text-ink/60 hover:text-ink")
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <Button onClick={sendCode} busy={busy} fullWidth>Send code</Button>
            </>
          )}

          {otpStep === "code" && (
            <>
              <p className="text-sm text-muted">
                Enter the code sent via {sentChannel === "whatsapp" ? "WhatsApp" : "SMS"} to{" "}
                <span className="font-semibold text-ink">{data.phone}</span>.
              </p>
              {devOtp && (
                <p className="text-sm text-muted">Dev code: <b className="text-ink">{devOtp}</b></p>
              )}
              {remainingMs != null && (
                <p className={"text-sm font-semibold " + (codeExpired ? "text-red-600" : "text-muted")}>
                  {codeExpired ? "Code expired — request a new one." : `Code expires in ${formatRemaining(remainingMs)}`}
                </p>
              )}
              <OtpInput value={code} onChange={setCode} autoFocus />
              <OtpResend
                identifier={data.phone}
                sentChannel={sentChannel}
                sentKey={otpSentKey}
                fallbackAfterSeconds={fallbackAfter}
                onSent={handleResent}
              />
              <Button onClick={verifyAndSubmit} busy={busy} disabled={code.length !== 6} fullWidth>
                Verify & submit application
              </Button>
              <Button variant="neutral" onClick={() => { setOtpStep("send"); setExpiresAt(null); setDevOtp(""); }} fullWidth>
                Use a different number
              </Button>
            </>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={goBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M19 12H5M5 12l6-6M5 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">Become a rider</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Logistics & fleet partner onboarding.
      </h1>

      <div className="mt-6 border-y border-line py-4">
        <Stepper current={stepIndex} furthest={furthest} onStepClick={jumpTo} />
      </div>

      <div className="mt-6">
        {step.key === "identity" && <StepIdentity data={data} update={update} errors={errors} />}
        {step.key === "guarantors" && <StepGuarantors data={data} update={update} errors={errors} />}
        {step.key === "license" && <StepLicense data={data} update={update} errors={errors} />}
        {step.key === "vehicle" && <StepVehicle data={data} update={update} errors={errors} />}
        {step.key === "banking" && <StepBanking data={data} update={update} errors={errors} />}
      </div>

      <Button onClick={goNext} fullWidth className="mt-6">
        {stepIndex === RIDER_STEPS.length - 1 ? "Continue to verify & submit" : "Continue"}
      </Button>
    </div>
  );
}

export default RiderApplicationWizard;
