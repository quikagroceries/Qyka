'use client';

import { useEffect, useState } from "react";
import StatTile from "@/components/ui/StatTile";
import { usePageSearch } from "@/components/layout/PageSearchContext";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import SectionHeader from "@/components/ui/SectionHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { errMsg } from "@/lib/hubUtils";

// Readable but unguessable: no 0/O/1/l/I so it survives being read out loud.
function generatePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function adminNote(a) {
  if (a.is_bootstrap) return "Owner account (set on the server)";
  if (!a.has_password) return "Legacy phone admin - can't sign in; remove it";
  if (a.must_change_password) return "Hasn't signed in and set a password yet";
  return null;
}

function AddAdminCard({ onAdded }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(generatePassword);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<any>(null);
  const [level, setLevel] = useState<"support" | "owner">("support");

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const admin = await api.addAdmin({ email, full_name: name || undefined, temporary_password: password, level });
      setAdded({ email: admin.email, password, level: admin.level });
      setEmail(""); setName(""); setPassword(generatePassword());
      onAdded();
    } catch (err: any) {
      setError(
        err.message.startsWith("409") ? (err.message.includes("already an admin") ? "That email is already an admin." : "That email already belongs to a customer or agent account - use a different one.")
        : "Could not add the admin. (" + err.message + ")"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6">
      <SectionHeader icon="plus" title="Add an admin" subtitle="They'll sign in with this email and the temporary password, then must set their own." className="mb-4" />
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input placeholder="Full name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2 sm:col-span-2">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required
            aria-label="Temporary password" className="font-mono" />
          <Button type="button" variant="neutral" onClick={() => setPassword(generatePassword())} className="shrink-0 text-sm">
            New
          </Button>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-semibold text-ink/80">Access level</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["support", "Support", "Runs day-to-day: orders, people, hubs, applications. Can't change money rules, wallets or other admins."],
              ["owner", "Owner", "Everything, including money rules, platform settings, other admins and the audit log."],
            ] as const).map(([key, title, body]) => (
              <label
                key={key}
                className={"flex cursor-pointer gap-3 rounded-2xl border-2 p-3 " + (level === key ? "border-brand-orange bg-brand-orange/10" : "border-line")}
              >
                <input type="radio" name="level" checked={level === key} onChange={() => setLevel(key)} className="mt-1 accent-brand-orange" />
                <span>
                  <span className="block font-semibold text-ink">{title}</span>
                  <span className="block text-sm text-muted">{body}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" busy={busy}>Add admin</Button>
        </div>
      </form>
      {added && (
        <div className="mt-4 rounded-2xl bg-brand-green/10 p-4 text-sm text-ink">
          <p className="font-semibold">{added.email} is now {added.level === "owner" ? "an owner" : "a support admin"}.</p>
          <p className="mt-1 text-muted">Send them this temporary password privately - it won&apos;t be shown again:</p>
          <p className="mt-2 select-all break-all font-mono text-base">{added.password}</p>
        </div>
      )}
    </Card>
  );
}

function AdminAdmins() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<any>(null);
  const [confirmingId, setConfirmingId] = useState<any>(null);
  const [busyId, setBusyId] = useState<any>(null);
  const [error, setError] = useState("");
  const search = usePageSearch("Search admins…");

  async function refresh() {
    try {
      setAdmins(await api.listAdmins());
      setError("");
    } catch (e: any) {
      setError("Could not load admins. (" + e.message + ")");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleLevel(a) {
    setError(""); setBusyId(a.id);
    try {
      await api.setAdminLevel(a.id, a.level === "owner" ? "support" : "owner");
      await refresh();
    } catch (e: any) {
      setError("Could not change the level: " + errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id) {
    setError(""); setBusyId(id);
    try {
      await api.removeAdmin(id);
      setConfirmingId(null);
      await refresh();
    } catch (e: any) {
      setError("Could not remove this admin: " + e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <AdminPageHeader icon="shield" section="People" title="Admins" description="Everyone who can sign in to this dashboard. Owners can do everything; support runs day-to-day operations.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Admins" value={admins?.length ?? "—"} />
          <StatTile label="Awaiting first sign-in" value={admins ? admins.filter((a) => a.must_change_password).length : "—"} />
        </div>
      </AdminPageHeader>

      <AddAdminCard onAdded={refresh} />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {admins === null ? (
        <div className="space-y-2">{[0, 1].map((i) => <CardSkeleton key={i} />)}</div>
      ) : (
        <div className="space-y-2">
          {admins.filter((a) => !search || [a.full_name, a.email, a.phone].some((v) => String(v || "").toLowerCase().includes(search))).map((a) => {
            const isMe = a.id === user?.id;
            const note = adminNote(a);
            return (
              <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">
                    {a.full_name || a.email || a.phone}
                    {isMe && <span className="ml-2 text-sm font-normal text-muted">(you)</span>}
                  </div>
                  <div className="text-sm text-muted">
                    {a.email || a.phone}
                    <span className={"ml-2 rounded-full px-2 py-0.5 text-xs font-bold capitalize " + (a.level === "owner" ? "bg-brand-orange/15 text-brand-orange-dark" : "bg-sunken text-muted")}>
                      {a.level}
                    </span>
                  </div>
                  {note && <div className="mt-1 text-sm text-amber-700">{note}</div>}
                </div>
                {!isMe && !a.is_bootstrap && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      variant="neutral"
                      className="text-sm"
                      busy={busyId === a.id}
                      onClick={() => handleLevel(a)}
                    >
                      {a.level === "owner" ? "Make support" : "Make owner"}
                    </Button>
                    {confirmingId === a.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted">Remove admin access?</span>
                        <Button variant="neutral" onClick={() => setConfirmingId(null)} disabled={busyId === a.id} className="text-sm">
                          Cancel
                        </Button>
                        <Button onClick={() => handleRemove(a.id)} busy={busyId === a.id} className="text-sm">
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button variant="neutral" onClick={() => setConfirmingId(a.id)} className="text-sm">
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminAdmins;
