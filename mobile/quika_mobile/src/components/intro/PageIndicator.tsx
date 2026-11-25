import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

const ACTIVE_W = 36;
const TRACK = 'rgba(26, 26, 26, 0.2)';
const FILL = '#1A1A1A';

/** The current page is a pill that fills as the slideshow runs toward the next slide; the rest are light grey dots. */
export default function PageIndicator({ count, page, progress }: { count: number; page: number; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({ width: progress.value * ACTIVE_W }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: count }, (_, i) =>
        i === page ? (
          <View key={i} style={{ width: ACTIVE_W, height: 10, borderRadius: 5, backgroundColor: TRACK, overflow: 'hidden' }}>
            <Animated.View style={[{ height: 10, borderRadius: 5, backgroundColor: FILL }, fill]} />
          </View>
        ) : (
          <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: TRACK }} />
        ),
      )}
    </View>
  );
}
