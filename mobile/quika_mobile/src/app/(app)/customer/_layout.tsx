import { Redirect } from 'expo-router';

import { Tabs, tabScreenOptions } from '@/lib/tabs';
import { useSession } from '@/lib/session';

export default function CustomerLayout() {
  const { user } = useSession();
  if (user && user.role !== 'customer') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="new-order" options={{ title: 'Order' }} />
      <Tabs.Screen name="index" options={{ title: 'Track' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
      {/* Detail screens, not tabs. */}
      <Tabs.Screen name="orders/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/[orderId]" options={{ href: null }} />
    </Tabs>
  );
}
