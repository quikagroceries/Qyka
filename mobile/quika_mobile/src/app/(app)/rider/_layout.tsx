import { Redirect, Tabs } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useSession } from '@/lib/session';

export default function RiderLayout() {
  const { user } = useSession();
  // Only riders belong here; anyone else goes back to their own home.
  if (user && user.role !== 'rider') return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primaryDark,
        tabBarInactiveTintColor: Colors.faint,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.line },
        tabBarIconStyle: { display: 'none' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
