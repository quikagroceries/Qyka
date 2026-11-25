import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

export const FLOW_STEPS = [
  { key: 'list', label: 'List' },
  { key: 'market', label: 'Market' },
  { key: 'address', label: 'Delivery' },
  { key: 'quote', label: 'Estimate' },
] as const;
export type FlowStepKey = (typeof FLOW_STEPS)[number]['key'];

// Earlier steps are tappable so a customer can go back and change them.
export default function FlowSteps({ current, onStepClick }: { current: FlowStepKey; onStepClick: (k: FlowStepKey) => void }) {
  const idx = FLOW_STEPS.findIndex((s) => s.key === current);
  return (
    <View className="flex-row items-center gap-2">
      {FLOW_STEPS.map((s, i) => {
        const done = i < idx;
        const isCurrent = i === idx;
        return (
          <View key={s.key} className="flex-row items-center gap-2">
            <Pressable disabled={!done} onPress={() => onStepClick(s.key)} className="items-center gap-0.5">
              <View
                className={
                  'h-7 w-7 items-center justify-center rounded-full ' +
                  (done ? 'bg-brand-orange' : isCurrent ? 'border-2 border-brand-orange bg-brand-orange/15' : 'bg-sunken')
                }>
                <Text className={'text-xs font-bold ' + (done ? 'text-ink' : isCurrent ? 'text-brand-orange-dark' : 'text-faint')}>{done ? '✓' : i + 1}</Text>
              </View>
              <Text className={'text-[10px] font-semibold ' + (isCurrent ? 'text-ink' : 'text-faint')}>{s.label}</Text>
            </Pressable>
            {i < FLOW_STEPS.length - 1 ? <View className={'mb-3 h-0.5 w-5 ' + (done ? 'bg-brand-orange' : 'bg-line-strong')} /> : null}
          </View>
        );
      })}
    </View>
  );
}
