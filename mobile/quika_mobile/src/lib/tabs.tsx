import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import AppHeader from '@/components/AppHeader';
import FloatingTabBar from '@/components/FloatingTabBar';

// Shared tab bar look for the role apps: a floating, semi-transparent pill.
export const tabScreenOptions = {
  headerShown: true,
  sceneStyle: { backgroundColor: '#F0ECE0' },
  header: (props: Parameters<typeof AppHeader>[0]) => <AppHeader {...props} />,
  tabBarStyle: { position: 'absolute' as const, backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
};

// `tabBar` is a navigator prop, not a screen option, so layouts pass it on <Tabs>.
export const renderTabBar = (props: Parameters<typeof FloatingTabBar>[0]) => <FloatingTabBar {...props} />;

const PATHS: Record<string, string[]> = {
  order: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  track: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  messages: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  account: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
  tasks: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  jobs: ['M22 17.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z', 'M9 17.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z', 'M12 17.5V14l-3-3 4-3 2 3h2', 'M16 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'],
  earnings: ['M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1', 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'],
  hub: ['m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7', 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4', 'M2 7h20v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2 2 0 0 1-2-2V7Z'],
};

// Plain line icons (Lucide-style) drawn with react-native-svg, coloured by the tab bar.
export const tabIcon = (name: string) => {
  const render = ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color as string} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {(PATHS[name] ?? []).map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
  return render;
};

export const ICONS = {
  order: 'order',
  track: 'track',
  messages: 'messages',
  account: 'account',
  tasks: 'tasks',
  jobs: 'jobs',
  earnings: 'earnings',
  hub: 'hub',
} as const;

export { Tabs };
