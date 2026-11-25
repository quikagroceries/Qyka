import Backdrop, { type BackdropPiece } from '@/components/Backdrop';

const PIECES: BackdropPiece[] = [
  { src: require('../../../assets/illustrations/decorative-squiggle-1.webp'), width: 74, ratio: 3.1, top: '5%', left: '6%', tilt: -8, opacity: 0.22 },
  { src: require('../../../assets/illustrations/net-bag.webp'), width: 46, ratio: 1, top: '15%', right: '7%', tilt: 10, opacity: 0.3 },
  { src: require('../../../assets/illustrations/decorative-squiggle-arrow.webp'), width: 84, ratio: 3.6, top: '31%', right: '3%', tilt: 24, opacity: 0.22 },
  { src: require('../../../assets/illustrations/decorative-squiggle-leaf.webp'), width: 96, ratio: 3.9, top: '60%', left: '2%', tilt: -12, opacity: 0.5 },
  { src: require('../../../assets/illustrations/garlic.webp'), width: 42, ratio: 1, top: '76%', right: '5%', tilt: -14, opacity: 0.3 },
  { src: require('../../../assets/illustrations/decorative-squiggle-2.webp'), width: 70, ratio: 3.1, top: '88%', right: '7%', tilt: 10, opacity: 0.22 },
];

export default function WelcomeBackdrop() {
  return <Backdrop pieces={PIECES} />;
}
