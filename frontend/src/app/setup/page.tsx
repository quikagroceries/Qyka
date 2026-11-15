"use client";

import { useRouter } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import AuthShell from "@/components/auth/AuthShell";
import ProfileSetup from "@/screens/auth/ProfileSetup";
import { useAuth } from "@/components/auth/AuthProvider";

export default function SetupPage() {
  const { user, setUser, onDuty } = useAuth();
  const router = useRouter();

  return (
    <RequireAuth roles={["CUSTOMER", "AGENT"]}>
      <AuthShell>
        <ProfileSetup
          user={user}
          onDone={(u) => {
            setUser(u);
            const role = (u.role || "").toUpperCase();
            if (role === "ADMIN") router.replace("/admin");
            else if (role === "AGENT") router.replace(onDuty ? "/agent" : "/shop");
            else router.replace("/shop");
          }}
        />
      </AuthShell>
    </RequireAuth>
  );
}
