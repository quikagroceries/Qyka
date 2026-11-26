import { ICONS, Tabs, renderTabBar, tabIcon, tabScreenOptions } from '@/lib/tabs';

export default function ShopkeeperTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={renderTabBar}>
      <Tabs.Screen name="index" options={{ title: 'Hub', tabBarIcon: tabIcon(ICONS.hub) }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: tabIcon(ICONS.earnings) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon(ICONS.account) }} />
    </Tabs>
  );
}
