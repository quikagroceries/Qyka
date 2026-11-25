import { Image, View } from 'react-native';

import Wordmark from '@/components/splash/Wordmark';
import { GROCERIES, QYKA } from '@/components/splash/wordmarks';

const INK = '#1A1A1A';

// The logo's proportions at its design size: the Q icon beside "Qyka" over "Groceries".
export const LOGO = { icon: 100, gap: 14, qykaW: 84, groceriesW: 160, wordGap: 6 };

/** The full logo, scaled so the icon is `height` tall. */
export default function Logo({ height }: { height: number }) {
  const k = height / LOGO.icon;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: LOGO.gap * k }}>
      <Image source={require('../../assets/images/splash-icon.png')} resizeMode="contain" style={{ width: height, height }} />
      <View style={{ width: LOGO.groceriesW * k, gap: LOGO.wordGap * k }}>
        <Wordmark mark={QYKA} color={INK} width={LOGO.qykaW * k} />
        <Wordmark mark={GROCERIES} color={INK} width={LOGO.groceriesW * k} />
      </View>
    </View>
  );
}
