"use client";
import Settings from "@/screens/shared/Settings";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ShopkeeperSettingsPage() {
  const { user, setUser, handleLogout } = useAuth();
  return <Settings user={user} onUserUpdated={setUser} onLogout={handleLogout} roleSwitch={null} />;
}
