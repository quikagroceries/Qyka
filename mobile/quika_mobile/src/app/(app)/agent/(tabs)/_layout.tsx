import { useAgentOrdersSync } from '@/lib/orderStore';
import { ICONS, Tabs, renderTabBar, tabIcon, tabScreenOptions } from '@/lib/tabs';

export default function AgentTabs() {
  // The agent's orders are asked for again every few seconds while they are in the app, so every tab sees the same, current list.
  useAgentOrdersSync(8000);
  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={renderTabBar}>
      <Tabs.Screen name="index" options={{ title: 'Tasks', tabBarIcon: tabIcon(ICONS.tasks) }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: tabIcon(ICONS.messages) }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: tabIcon(ICONS.earnings) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon(ICONS.account) }} />
    </Tabs>
  );
}
