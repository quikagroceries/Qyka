import { View } from 'react-native';

import SlideUp from '@/components/splash/SlideUp';
import { Text } from '@/components/Text';

export default function Tagline() {
  return (
    <View style={{ position: 'absolute', bottom: 72, left: 0, right: 0, alignItems: 'center' }}>
      <SlideUp delay={1450} distance={18}>
        <Text className="font-display text-[20px] tracking-tight text-ink">
          The market, <Text className="font-display text-[20px] tracking-tight text-brand-orange-dark">shopped for you.</Text>
        </Text>
      </SlideUp>
    </View>
  );
}
