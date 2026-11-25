import { Image, View } from 'react-native';

import { BACKDROP } from '@/components/intro/slides';

export default function IntroBackdrop() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {BACKDROP.map(({ src, size, tilt, ...pos }, i) => (
        <Image key={i} source={src} resizeMode="contain" style={{ position: 'absolute', width: size, height: size, opacity: 0.28, transform: [{ rotate: `${tilt}deg` }], ...pos }} />
      ))}
    </View>
  );
}
