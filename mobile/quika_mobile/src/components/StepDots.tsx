import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';

const INK = '#1A1A1A';
const TRACK = 'rgba(26, 26, 26, 0.2)';

/** The intro's page indicator for any multi-step flow: current step a wide ink pill, finished steps tappable dots. */
export default function StepDots({ labels, index, onGo }: { labels: string[]; index: number; onGo?: (i: number) => void }) {
  return (
    <View className="items-center gap-2">
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {labels.map((l, i) => (
          <Pressable
            key={l}
            disabled={!onGo || i >= index}
            hitSlop={8}
            accessibilityLabel={l}
            onPress={() => onGo?.(i)}
            style={{ width: i === index ? 36 : 10, height: 10, borderRadius: 5, backgroundColor: i <= index ? INK : TRACK }}
          />
        ))}
      </View>
      <Text className="text-xs font-semibold text-muted">
        Step {index + 1} of {labels.length} · {labels[index]}
      </Text>
    </View>
  );
}
