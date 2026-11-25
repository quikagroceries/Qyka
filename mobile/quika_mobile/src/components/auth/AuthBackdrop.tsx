import Backdrop, { type BackdropPiece } from '@/components/Backdrop';

const PIECES: BackdropPiece[] = [
  { src: require('../../../assets/illustrations/net-bag.webp'), width: 46, ratio: 1, top: '90%', right: '8%', tilt: 10, opacity: 0.3 },
  { src: require('../../../assets/illustrations/decorative-squiggle-leaf.webp'), width: 96, ratio: 3.9, top: '84%', left: '3%', tilt: -10, opacity: 0.5 },
  { src: require('../../../assets/illustrations/decorative-squiggle-1.webp'), width: 70, ratio: 3.1, top: '17%', right: '3%', tilt: 8, opacity: 0.22 },
];

export default function AuthBackdrop() {
  return <Backdrop pieces={PIECES} />;
}
