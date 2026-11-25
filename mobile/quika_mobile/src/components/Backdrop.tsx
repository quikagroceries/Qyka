import { Image, View, type ImageSourcePropType } from 'react-native';

export type BackdropPiece = {
  src: ImageSourcePropType;
  width: number;
  ratio: number;
  top: `${number}%`;
  left?: `${number}%`;
  right?: `${number}%`;
  tilt: number;
  opacity: number;
};

/** Small static pieces scattered behind a screen's content. */
export default function Backdrop({ pieces }: { pieces: BackdropPiece[] }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {pieces.map(({ src, width, ratio, tilt, opacity, ...pos }, i) => (
        <Image key={i} source={src} resizeMode="contain" style={{ position: 'absolute', width, height: width / ratio, opacity, transform: [{ rotate: `${tilt}deg` }], ...pos }} />
      ))}
    </View>
  );
}
