import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';

/**
 * A slim, solid white floating pill. One peach capsule slides behind the
 * active tab; every tab keeps a small label under its icon. Tabs marked `href: null` (detail
 * screens) don't appear.
 */
const PAD = 6;

export default function FloatingTabBar({ state, descriptors, emitter, navigateToTab, insets: navInsets }: BottomTabBarProps) {
  const safe = useSafeAreaInsets();
  const insets = { bottom: Math.max(safe.bottom, navInsets?.bottom ?? 0) };
  const activeKey = state.routes[state.index]?.key;
  const visible = state.routes.filter((r) => (descriptors[r.key].options as { href?: unknown }).href !== null);

  const [width, setWidth] = useState(0);
  const tabW = visible.length ? Math.max(width - PAD * 2, 0) / visible.length : 0;
  const activeIdx = Math.max(visible.findIndex((r) => r.key === activeKey), 0);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withTiming(activeIdx * tabW, { duration: 150, easing: Easing.out(Easing.cubic) });
  }, [activeIdx, tabW, x]);
  const capsule = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 20 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        className="flex-row items-center rounded-full border border-line"
        style={{ padding: PAD, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
        {tabW > 0 ? (
          <Animated.View
            pointerEvents="none"
            className="absolute rounded-full bg-brand-orange"
            style={[{ left: PAD, top: PAD, bottom: PAD, width: tabW }, capsule]}
          />
        ) : null}
        {visible.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.key === activeKey;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable key={route.key} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: focused }} accessibilityLabel={label} className="flex-1 items-center gap-0.5 py-2">
              {options.tabBarIcon?.({ focused, color: focused ? '#2A2118' : '#8A7F74', size: 22 })}
              <Text className={'text-[10px] font-bold ' + (focused ? 'text-ink' : 'text-faint')}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
