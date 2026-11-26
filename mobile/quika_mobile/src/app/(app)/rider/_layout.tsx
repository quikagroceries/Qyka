import { Redirect } from 'expo-router';

import { useRiderSync } from '@/lib/riderStore';
import { ICONS, Tabs, tabIcon, renderTabBar, tabScreenOptions } from '@/lib/tabs';
import { useSession } from '@/lib/session';

export default function RiderLayout() {
  // The rider's jobs are asked for again every few seconds while they are in the app.
  useRiderSync(5000);
  const { user } = useSession();
  // Only riders belong here; anyone else goes back to their own home.
  if (user && user.role !== 'rider') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={renderTabBar}>
      <Tabs.Screen name="index" options={{ title: 'Jobs', tabBarIcon: tabIcon(ICONS.jobs) }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: tabIcon(ICONS.earnings) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon(ICONS.account) }} />
    </Tabs>
  );
}
