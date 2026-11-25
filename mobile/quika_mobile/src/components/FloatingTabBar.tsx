import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';

/**
 * A floating pill tab bar: the active tab grows into a peach pill that shows
 * its label, the others stay as quiet icons. Tabs marked `href: null` (detail
 * screens) don't appear.
 */
export default function FloatingTabBar({ state, descriptors, emitter, navigateToTab, insets: navInsets }: BottomTabBarProps) {
  const safe = useSafeAreaInsets();
  const insets = { bottom: Math.max(safe.bottom, navInsets?.bottom ?? 0) };
  const activeKey = state.routes[state.index]?.key;
  const visible = state.routes.filter((r) => (descriptors[r.key].options as { href?: unknown }).href !== null);

  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 16, paddingTop: 8 }} className="bg-canvas">
      <View className="flex-row items-center justify-between rounded-full border border-line bg-surface p-1.5 shadow-md">
        {visible.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.key === activeKey;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable key={route.key} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: focused }} accessibilityLabel={label} className="flex-1 items-center">
              <Animated.View
                layout={LinearTransition.springify().damping(20).stiffness(220)}
                className={focused ? 'flex-row items-center gap-2 rounded-full bg-brand-orange/25 px-4 py-2' : 'px-3 py-2'}>
                {options.tabBarIcon?.({ focused, color: '#D9702F', size: 28 })}
                {focused ? (
                  <Animated.View entering={FadeIn.duration(180)}>
                    <Text className="text-sm font-bold text-ink">{label}</Text>
                  </Animated.View>
                ) : null}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
