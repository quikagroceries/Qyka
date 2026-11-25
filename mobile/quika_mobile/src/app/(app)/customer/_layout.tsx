import { Redirect } from 'expo-router';

import { ICONS, Tabs, tabIcon, tabScreenOptions } from '@/lib/tabs';
import { useSession } from '@/lib/session';

export default function CustomerLayout() {
  const { user } = useSession();
  if (user && user.role !== 'customer') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="new-order" options={{ title: 'Order', tabBarIcon: tabIcon(ICONS.order) }} />
      <Tabs.Screen name="index" options={{ title: 'Track', tabBarIcon: tabIcon(ICONS.track) }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: tabIcon(ICONS.messages) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon(ICONS.account) }} />
      {/* Detail screens, not tabs. */}
      <Tabs.Screen name="orders/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/[orderId]" options={{ href: null }} />
    </Tabs>
  );
}
