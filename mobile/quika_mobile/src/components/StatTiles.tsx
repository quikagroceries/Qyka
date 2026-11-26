import { Image, Pressable, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/Text';

export type StatTile = { value: string | number; label: string; art: ImageSourcePropType; tint: string; /** Peach number, for the figure to watch. */ hot?: boolean; /** Makes the tile a button. */ onPress?: () => void; /** Shows it as the chosen one. */ selected?: boolean };

/** A row of small stat cards, each with an illustration tile on top, like the order cards and history rows. */
export default function StatTiles({ items, delay = 120 }: { items: StatTile[]; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(450)} className="flex-row gap-3">
      {items.map((x) => {
        const card = 'flex-1 items-center gap-2 rounded-3xl bg-surface px-2 py-3.5 shadow-sm ' + (x.selected ? 'border-2 border-brand-orange' : 'border border-line');
        const body = (
          <>
            <View className={`h-12 w-12 items-center justify-center rounded-2xl ${x.tint}`}>
              <Image source={x.art} resizeMode="contain" className="h-9 w-9" />
            </View>
            <View className="items-center gap-0.5">
              <Text className={'text-lg font-extrabold tracking-tight ' + (x.hot ? 'text-brand-orange-dark' : 'text-ink')} numberOfLines={1} adjustsFontSizeToFit>
                {x.value}
              </Text>
              <Text className="text-[11px] font-semibold text-muted" numberOfLines={1}>
                {x.label}
              </Text>
            </View>
          </>
        );
        return x.onPress ? (
          <Pressable
            key={x.label}
            onPress={x.onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: !!x.selected }}
            className={card + ' active:bg-surface-2'}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            {body}
          </Pressable>
        ) : (
          <View key={x.label} className={card}>
            {body}
          </View>
        );
      })}
    </Animated.View>
  );
}
