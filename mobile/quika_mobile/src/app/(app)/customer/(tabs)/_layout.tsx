import { ICONS, Tabs, renderTabBar, tabIcon, tabScreenOptions } from '@/lib/tabs';

export default function CustomerTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={renderTabBar}>
      <Tabs.Screen name="new-order" options={{ title: 'Order', tabBarIcon: tabIcon(ICONS.order) }} />
      <Tabs.Screen name="index" options={{ title: 'Track', tabBarIcon: tabIcon(ICONS.track) }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: tabIcon(ICONS.messages) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon(ICONS.account) }} />
    </Tabs>
  );
}
