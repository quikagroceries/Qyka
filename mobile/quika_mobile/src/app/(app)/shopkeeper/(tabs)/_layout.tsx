import { useHubSync } from '@/lib/hubStore';
import { ICONS, Tabs, renderTabBar, tabIcon, tabScreenOptions } from '@/lib/tabs';

export default function ShopkeeperTabs() {
  // The hub's orders are asked for again every few seconds while the shopkeeper is in the app.
  useHubSync(6000);
  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={renderTabBar}>
      <Tabs.Screen name="index" options={{ title: 'Hub', tabBarIcon: tabIcon(ICONS.hub) }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: tabIcon(ICONS.earnings) }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon(ICONS.account) }} />
    </Tabs>
  );
}
