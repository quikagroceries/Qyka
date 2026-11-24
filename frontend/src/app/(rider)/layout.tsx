"use client";

import { usePathname } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { RIDER_NAV } from "@/lib/nav";

function activeKeyFromPath(pathname: string) {
  if (pathname.startsWith("/rider/earnings")) return "earnings";
  if (pathname.startsWith("/rider/settings")) return "settings";
  return "jobs";
}

export default function RiderLayout({ children }: any) {
  const { user, handleLogout } = useAuth();
  const pathname = usePathname();

  return (
    <RequireAuth roles={["RIDER"]}>
      <AppShell
        navItems={RIDER_NAV}
        activeKey={activeKeyFromPath(pathname)}
        user={user}
        onLogout={handleLogout}
        roleSwitch={null}
        bottomNav
        hideLocation
        homeHref="/rider"
        fullWidth
        contentClassName="bg-canvas"
      >
        {children}
      </AppShell>
    </RequireAuth>
  );
}
