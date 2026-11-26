import { Redirect } from 'expo-router';

import { ICONS, Tabs, tabIcon, renderTabBar, tabScreenOptions } from '@/lib/tabs';
import { useSession } from '@/lib/session';

export default function RiderLayout() {
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
