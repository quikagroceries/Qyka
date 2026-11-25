import { Redirect } from 'expo-router';

import { Tabs, tabScreenOptions } from '@/lib/tabs';
import { useSession } from '@/lib/session';

export default function RiderLayout() {
  const { user } = useSession();
  // Only riders belong here; anyone else goes back to their own home.
  if (user && user.role !== 'rider') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
