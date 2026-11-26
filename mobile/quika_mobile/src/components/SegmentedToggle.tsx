import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/Text';

const PAD = 5;

export type Segment<T extends string> = { id: T; label: string; icon: string[]; count?: number };

/** Line icon from Lucide-style path strings. */
function Icon({ paths, color }: { paths: string[]; color: string }): ReactNode {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

/** A pill switch where one peach capsule springs between the options, like the tab bar's. */
export default function SegmentedToggle<T extends string>({ value, onChange, segments }: { value: T; onChange: (v: T) => void; segments: Segment<T>[] }) {
  const [width, setWidth] = useState(0);
  const segW = segments.length ? Math.max(width - PAD * 2, 0) / segments.length : 0;
  const idx = Math.max(segments.findIndex((s) => s.id === value), 0);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withTiming(idx * segW, { duration: 150, easing: Easing.out(Easing.cubic) });
  }, [idx, segW, x]);
  const capsule = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="flex-row rounded-full border border-line bg-surface"
      style={{ padding: PAD, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
      {segW > 0 ? <Animated.View pointerEvents="none" className="absolute rounded-full bg-brand-orange" style={[{ left: PAD, top: PAD, bottom: PAD, width: segW }, capsule]} /> : null}
      {segments.map((s) => {
        const on = s.id === value;
        return (
          <Pressable key={s.id} onPress={() => onChange(s.id)} accessibilityRole="button" accessibilityState={{ selected: on }} className="flex-1 flex-row items-center justify-center gap-2 py-3">
            <Icon paths={s.icon} color={on ? '#1A1A1A' : '#8A7F74'} />
            <Text className={'text-sm font-bold ' + (on ? 'text-ink' : 'text-muted')}>{s.label}</Text>
            {s.count ? (
              <View className={'min-w-[20px] items-center rounded-full px-1.5 py-0.5 ' + (on ? 'bg-ink' : 'bg-sunken')}>
                <Text className={'text-[11px] font-bold ' + (on ? 'text-surface' : 'text-muted')}>{s.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
