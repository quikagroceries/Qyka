import type { ReactNode } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { Float } from '@/components/ui';

/**
 * The compact page title for screens you open every day: a left-aligned two-tone headline,
 * one line of status under it, and either a small illustration or an action on the right.
 * The big centred hero is kept for first-time and empty states.
 */
export default function PageHeader({ top, accent, subtitle, art, artSize = { width: 88, height: 66 }, right }: { top: string; accent: string; subtitle?: string; art?: ImageSourcePropType; artSize?: { width: number; height: number }; right?: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(450)} className="flex-row items-center gap-3">
      <View className="flex-1 gap-1">
        <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-ink">
          {top ? `${top} ` : ''}
          <Text className="text-[28px] font-extrabold leading-[34px] tracking-tight text-brand-orange-dark">{accent}</Text>
        </Text>
        {subtitle ? <Text className="text-sm leading-5 text-muted">{subtitle}</Text> : null}
      </View>
      {art ? (
        <Float>
          <Image source={art} resizeMode="contain" style={artSize} />
        </Float>
      ) : null}
      {right}
    </Animated.View>
  );
}
