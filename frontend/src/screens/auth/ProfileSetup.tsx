'use client';

import { useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import OtpInput from "@/components/auth/OtpInput";

const isDev = process.env.NODE_ENV !== "production";

function looksLikeEmail(v: string) {
  return v.includes("@");
}

// Shown exactly once, right after first login, to anyone with no name saved
// yet. A brand-new signup is always role=CUSTOMER (the only role OTP verify
// self-assigns), so this is now just a name (+ optional address, + optional
// email) prompt. Becoming an agent is its own admin-approved application -
// never self-granted here. It can be started from this screen too, because an
// account with no name yet is held on /setup (RequireAuth), so a link out to
// Settings would only bounce straight back.
function ProfileSetup({ user, onDone }: any) {
  const isCustomer = (user.role || "").toUpperCase() === "CUSTOMER";

  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Optional: apply to become an agent in the same step.
  const [applying, setApplying] = useState(false);
  const [markets, setMarkets] = useState<any[]>([]);
  const [marketId, setMarketId] = useState("");
  const [applyNote, setApplyNote] = useState("");
  // Set once the profile is saved but the application didn't go through, so
  // the person isn't stuck here: they can carry on and apply from Settings.
  const [savedUser, setSavedUser] = useState<any>(null);

  function startApplying() {
    setApplying(true);
    if (markets.length === 0) api.getMarkets().then(setMarkets).catch(() => setError("Could not load the markets. Try again."));
  }

  // Email is optional here and independent of the main "Continue" action -
  // a phone signup has no email on file yet (see auth/models.py::User), so
  // this offers to add + verify one via the same OTP flow sign-in uses,
  // without blocking anyone who'd rather skip it and add it later from
  // Settings.
  const [email, setEmail] = useState("");
  const [emailStep, setEmailStep] = useState<"idle" | "sent" | "verified">(
    user.email ? "verified" : "idle"
  );
  const [emailCode, setEmailCode] = useState("");
  const [emailDevOtp, setEmailDevOtp] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState("");

  async function handleSendEmailCode() {
    setEmailError("");
    setEmailBusy(true);
    try {
      const data = await api.requestOtp(email.trim());
      if (data && data.dev_otp) setEmailDevOtp(data.dev_otp);
      setEmailCode("");
      setEmailStep("sent");
    } catch (e: any) {
      setEmailError("Could not send a code. Check the address and try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleVerifyEmailCode() {
    setEmailError("");
    setEmailBusy(true);
    try {
      await api.linkEmail(email.trim(), emailCode);
      setEmailStep("verified");
    } catch (e: any) {
      setEmailError("Wrong or expired code. Request a new one.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleContinue() {
    setError("");
    setBusy(true);
    let updated: any;
    try {
      updated = await api.updateProfile({
        full_name: fullName.trim(),
        ...(isCustomer ? { default_delivery_address: address.trim() || null } : {}),
      });
    } catch (e: any) {
      setError("Could not save: " + e.message);
      setBusy(false);
      return;
    }
    if (applying && marketId) {
      try {
        await api.applyAsAgent({ market_id: marketId, note: applyNote.trim() || null });
      } catch (e: any) {
        // Profile is saved; don't trap them on this screen over the application.
        setSavedUser(updated);
        setError("Your profile is saved, but we couldn't send the application: " + e.message + " You can apply again from Settings.");
        setBusy(false);
        return;
      }
    }
    onDone(updated);
  }

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        Complete your profile
      </h1>
      <p className="mb-6 text-muted">
        Just a couple of details before we get you shopping.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Full name</span>
          <Input
            placeholder="e.g. Ada Obi"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>

        {isCustomer && (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">
              Delivery address <span className="font-normal text-faint">(optional)</span>
            </span>
            <Input
              placeholder="e.g. 12 Allen Avenue, Ikeja"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
        )}

        {!user.email && (
          <div>
            <span className="mb-1 block text-sm font-semibold text-ink">
              Email <span className="font-normal text-faint">(optional)</span>
            </span>

            {emailStep === "verified" ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-green">
                ✓ {email || "Email"} verified
              </p>
            ) : emailStep === "sent" ? (
              <div className="space-y-2">
                <p className="text-sm text-muted">
                  Enter the code sent to <span className="font-semibold text-ink">{email}</span>.
                </p>
                {isDev && emailDevOtp && (
                  <p className="text-sm text-muted">
                    Dev code: <b className="text-ink">{emailDevOtp}</b>
                  </p>
                )}
                <OtpInput value={emailCode} onChange={setEmailCode} autoFocus />
                <div className="flex gap-2">
                  <Button
                    variant="neutral"
                    onClick={() => setEmailStep("idle")}
                    disabled={emailBusy}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleVerifyEmailCode}
                    busy={emailBusy}
                    disabled={emailCode.length !== 6}
                    fullWidth
                  >
                    Verify email
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="neutral"
                  onClick={handleSendEmailCode}
                  busy={emailBusy}
                  disabled={!looksLikeEmail(email)}
                >
                  Send code
                </Button>
              </div>
            )}
            {emailError && (
              <p className="mt-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{emailError}</p>
            )}
          </div>
        )}

        {applying && (
          <div className="space-y-3 rounded-2xl bg-brand-orange/[0.08] p-4">
            <p className="text-sm font-bold text-ink">Apply as an agent</p>
            <p className="text-sm text-muted">
              We&apos;ll call <span className="font-semibold text-ink">{user.phone || "your number"}</span> (the number you signed in with)
              to verify you. Your name above is used for the application.
            </p>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">Market you know best</span>
              <Input as="select" value={marketId} onChange={(e) => setMarketId(e.target.value)}>
                <option value="">Select a market…</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.city ? ` — ${m.city}` : ""}</option>
                ))}
              </Input>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">
                Note <span className="font-normal text-faint">(optional)</span>
              </span>
              <Input
                placeholder="e.g. I already run a stall at this market"
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
              />
            </label>
          </div>
        )}

        {savedUser ? (
          <Button onClick={() => onDone(savedUser)} fullWidth className="mt-2">
            Continue to Qyka
          </Button>
        ) : (
          <Button
            onClick={handleContinue}
            busy={busy}
            disabled={!fullName.trim() || (applying && !marketId)}
            fullWidth
            className="mt-2"
          >
            {applying ? "Save and send my application" : "Continue"}
          </Button>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {isCustomer && !savedUser && (
        <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
          Want to shop for Qyka at a market?{" "}
          <button
            type="button"
            onClick={() => (applying ? setApplying(false) : startApplying())}
            className="font-semibold text-brand-orange hover:underline"
          >
            {applying ? "Never mind" : "Apply as an agent →"}
          </button>
        </p>
      )}
    </div>
  );
}

export default ProfileSetup;
