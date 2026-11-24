"use client";

import { usePathname } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { SHOPKEEPER_NAV } from "@/lib/nav";

function activeKeyFromPath(pathname: string) {
  // A single order's check-in screen is reached from the Hub queue, so it
  // identifies as Hub rather than leaving the nav showing nothing active.
  if (pathname.startsWith("/shopkeeper/earnings")) return "earnings";
  if (pathname.startsWith("/shopkeeper/settings")) return "settings";
  return "hub";
}

export default function ShopkeeperLayout({ children }: any) {
  const { user, handleLogout } = useAuth();
  const pathname = usePathname();

  return (
    <RequireAuth roles={["SHOPKEEPER"]}>
      <AppShell
        navItems={SHOPKEEPER_NAV}
        activeKey={activeKeyFromPath(pathname)}
        user={user}
        onLogout={handleLogout}
        roleSwitch={null}
        bottomNav
        hideLocation
        homeHref="/shopkeeper"
        fullWidth
        contentClassName="bg-canvas"
      >
        {children}
      </AppShell>
    </RequireAuth>
  );
}
