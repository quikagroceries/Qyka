import Backdrop, { type BackdropPiece } from '@/components/Backdrop';

const PIECES: BackdropPiece[] = [
  { src: require('../../../assets/illustrations/decorative-squiggle-1.webp'), width: 74, ratio: 3.1, top: '27%', right: '3%', tilt: 8, opacity: 0.22 },
  { src: require('../../../assets/illustrations/net-bag.webp'), width: 46, ratio: 1, top: '9%', right: '6%', tilt: 10, opacity: 0.3 },
  { src: require('../../../assets/illustrations/decorative-squiggle-leaf.webp'), width: 96, ratio: 3.9, top: '46%', left: '1%', tilt: -12, opacity: 0.45 },
  { src: require('../../../assets/illustrations/garlic.webp'), width: 40, ratio: 1, top: '64%', right: '4%', tilt: -14, opacity: 0.28 },
  { src: require('../../../assets/illustrations/decorative-squiggle-2.webp'), width: 70, ratio: 3.1, top: '82%', left: '6%', tilt: 8, opacity: 0.2 },
];

export default function OrderBackdrop() {
  return <Backdrop pieces={PIECES} />;
}
