import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';

export const FLOW_STEPS = [
  { key: 'list', label: 'Your list' },
  { key: 'market', label: 'Market' },
  { key: 'address', label: 'Delivery' },
  { key: 'quote', label: 'Estimate' },
] as const;
export type FlowStepKey = (typeof FLOW_STEPS)[number]['key'];

const INK = '#1A1A1A';
const TRACK = 'rgba(26, 26, 26, 0.2)';

/**
 * The intro's page indicator, for the order flow: the current step is a wide ink
 * pill, finished steps are ink dots you can tap to go back, the rest are faint.
 */
export default function FlowSteps({ current, onStepClick }: { current: FlowStepKey; onStepClick: (k: FlowStepKey) => void }) {
  const idx = FLOW_STEPS.findIndex((s) => s.key === current);
  return (
    <View className="items-center gap-2">
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {FLOW_STEPS.map((s, i) => (
          <Pressable
            key={s.key}
            disabled={i >= idx}
            hitSlop={8}
            accessibilityLabel={s.label}
            onPress={() => onStepClick(s.key)}
            style={{ width: i === idx ? 36 : 10, height: 10, borderRadius: 5, backgroundColor: i <= idx ? INK : TRACK }}
          />
        ))}
      </View>
      <Text className="text-xs font-semibold text-muted">
        Step {idx + 1} of {FLOW_STEPS.length} · {FLOW_STEPS[idx].label}
      </Text>
    </View>
  );
}
