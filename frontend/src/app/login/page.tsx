"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Login from "@/screens/auth/Login";
import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadGuestDraft } from "@/lib/guestDraft";

function safeNext(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function LoginPageInner() {
  const { token, user, loading, handleLoggedIn, homePath } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next")) || (loadGuestDraft() ? "/shop" : null);

  useEffect(() => {
    if (!loading && token && user) {
      router.replace(next || homePath);
    }
  }, [loading, token, user, homePath, router, next]);

  return (
    <AuthShell split>
      <Login onLoggedIn={(t) => handleLoggedIn(t)} />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas text-ink/50">
          Loading…
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
