import { useOrdersSync } from '@/lib/orderStore';
import { ICONS, Tabs, renderTabBar, tabIcon, tabScreenOptions } from '@/lib/tabs';

export default function CustomerTabs() {
  // Orders are asked for again every few seconds while the customer is in the app, so every tab sees the same, current list.
  useOrdersSync(10000);
  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={renderTabBar}>
      <Tabs.Screen name="new-order" options={{ title: 'Order', tabBarIcon: tabIcon(ICONS.order) }} />
      <Tabs.Screen name="index" options={{ title: 'Track', tabBarIcon: tabIcon(ICONS.track) }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: tabIcon(ICONS.messages) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon(ICONS.account) }} />
    </Tabs>
  );
}
