import type { ImageSourcePropType } from 'react-native';

export type Slide = { top: string; accent: string; body: string; image: ImageSourcePropType };

type BackdropItem = { src: ImageSourcePropType; size: number; top: `${number}%`; left?: `${number}%`; right?: `${number}%`; tilt: number };

// Fixed behind every slide: a few quiet illustrations scattered across the screen.
export const BACKDROP: BackdropItem[] = [
  { src: require('../../../assets/illustrations/tomatoes.webp'), size: 64, top: '9%', left: '5%', tilt: -16 },
  { src: require('../../../assets/illustrations/carrot.webp'), size: 58, top: '30%', right: '4%', tilt: 14 },
  { src: require('../../../assets/illustrations/eggs.webp'), size: 56, top: '55%', left: '3%', tilt: 10 },
  { src: require('../../../assets/illustrations/bread-loaf-1.webp'), size: 60, top: '70%', right: '6%', tilt: -12 },
];

export const SLIDES: Slide[] = [
  {
    top: 'Market-fresh,',
    accent: 'shopped for you.',
    body: 'Send your list and a real person walks the stalls for you.',
    image: require('../../../assets/illustrations/market-cart-vendor.webp'),
  },
  {
    top: 'Real people.',
    accent: 'Real bargains.',
    body: 'Agents haggle live, send you photos and ask before they spend more.',
    image: require('../../../assets/illustrations/trust-chat-tomato.webp'),
  },
  {
    top: 'Delivered to',
    accent: 'your door.',
    body: 'Collected at a trusted market hub and ridden to you, with a code only you hold.',
    image: require('../../../assets/illustrations/momo-handoff.webp'),
  },
];
