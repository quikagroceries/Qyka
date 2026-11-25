import Svg, { Path } from 'react-native-svg';

import type { QYKA } from '@/components/splash/wordmarks';

export default function Wordmark({ mark, color, width }: { mark: typeof QYKA; color: string; width: number }) {
  const height = (mark.height / mark.width) * width;
  return (
    <Svg width={width} height={height} viewBox={mark.viewBox}>
      <Path d={mark.d} fill={color} />
    </Svg>
  );
}
