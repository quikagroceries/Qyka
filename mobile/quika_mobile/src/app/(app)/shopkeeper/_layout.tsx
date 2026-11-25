import { Redirect } from 'expo-router';

import { ICONS, Tabs, tabIcon, tabScreenOptions } from '@/lib/tabs';
import { useSession } from '@/lib/session';

export default function ShopkeeperLayout() {
  const { user } = useSession();
  if (user && user.role !== 'shopkeeper') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Hub', tabBarIcon: tabIcon(ICONS.hub) }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: tabIcon(ICONS.earnings) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon(ICONS.account) }} />
      {/* A detail screen, not a tab. */}
      <Tabs.Screen name="orders/[id]" options={{ href: null }} />
    </Tabs>
  );
}
