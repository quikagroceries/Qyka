import { Tabs } from 'expo-router';

// Shared tab bar look for the role apps (text only, web palette).
export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: '#D9702F',
  tabBarInactiveTintColor: '#9B9B9B',
  tabBarLabelStyle: { fontSize: 13, fontWeight: '700' as const },
  tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#EEEEE8' },
  tabBarIconStyle: { display: 'none' as const },
};
export { Tabs };
