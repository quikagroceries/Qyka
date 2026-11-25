import { Redirect } from 'expo-router';

import { Tabs, tabScreenOptions } from '@/lib/tabs';
import { useSession } from '@/lib/session';

export default function AgentLayout() {
  const { user } = useSession();
  if (user && user.role !== 'agent') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
      {/* A detail screen, not a tab. */}
      <Tabs.Screen name="orders/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/[orderId]" options={{ href: null }} />
    </Tabs>
  );
}
