import type { ImageSourcePropType } from 'react-native';

// Port of frontend/src/lib/foodVisuals.ts. Metro needs literal require paths,
// so every image is listed once here and the keyword map points at them.
const IMG = {
  apple: require('../../assets/illustrations/apple-fruit-1.webp'),
  bananas: require('../../assets/illustrations/bananas-1.webp'),
  beans: require('../../assets/illustrations/beans.webp'),
  bread: require('../../assets/illustrations/bread-loaf-1.webp'),
  broccoli: require('../../assets/illustrations/broccoli.webp'),
  butter: require('../../assets/illustrations/butter-block.webp'),
  carrot: require('../../assets/illustrations/carrot.webp'),
  cheese: require('../../assets/illustrations/cheese-wedge-1.webp'),
  corn: require('../../assets/illustrations/corn.webp'),
  crayfish: require('../../assets/illustrations/crayfish.webp'),
  croissant: require('../../assets/illustrations/croissant.webp'),
  eggs: require('../../assets/illustrations/eggs.webp'),
  garlic: require('../../assets/illustrations/garlic.webp'),
  garri: require('../../assets/illustrations/garri.webp'),
  grapes: require('../../assets/illustrations/grapes.webp'),
  honey: require('../../assets/illustrations/honey-jar.webp'),
  milk: require('../../assets/illustrations/milk-carton-1.webp'),
  berries: require('../../assets/illustrations/mixed-berries.webp'),
  muffin: require('../../assets/illustrations/muffin.webp'),
  okra: require('../../assets/illustrations/okra.webp'),
  onion: require('../../assets/illustrations/onion.webp'),
  pasta: require('../../assets/illustrations/pasta-bag.webp'),
  pepper: require('../../assets/illustrations/pepper.webp'),
  pineapple: require('../../assets/illustrations/pineapple.webp'),
  rice: require('../../assets/illustrations/rice-bag.webp'),
  chicken: require('../../assets/illustrations/roast-chicken.webp'),
  tomatoes: require('../../assets/illustrations/tomatoes.webp'),
  fish: require('../../assets/illustrations/whole-fish.webp'),
  yam: require('../../assets/illustrations/yam.webp'),
  basket: require('../../assets/illustrations/grocery-basket.webp'),
  net: require('../../assets/illustrations/net-bag.webp'),
} as const satisfies Record<string, ImageSourcePropType>;

// Order matters: the dedicated art comes before the shared/generic regexes, so
// beans/garri/crayfish/okra get their own picture instead of a lookalike.
const KEYWORDS: [RegExp, ImageSourcePropType][] = [
  [/tomato/i, IMG.tomatoes],
  [/pepper/i, IMG.pepper],
  [/\byam\b/i, IMG.yam],
  [/\begg/i, IMG.eggs],
  [/\bbeans?\b/i, IMG.beans],
  [/garri/i, IMG.garri],
  [/crayfish/i, IMG.crayfish],
  [/okra/i, IMG.okra],
  [/rice|flour|semovita|grain/i, IMG.rice],
  [/fish|titus|croaker|catfish|prawn|shrimp|seafood/i, IMG.fish],
  [/chicken|turkey|meat|beef|goat|poultry|suya/i, IMG.chicken],
  [/banana|plantain/i, IMG.bananas],
  [/onion/i, IMG.onion],
  [/carrot/i, IMG.carrot],
  [/garlic|ginger/i, IMG.garlic],
  [/corn|maize/i, IMG.corn],
  [/broccoli|spinach|ugu|vegetable|greens|cabbage/i, IMG.broccoli],
  [/pineapple/i, IMG.pineapple],
  [/apple/i, IMG.apple],
  [/berry|berries|strawberry|raspberry/i, IMG.berries],
  [/grape/i, IMG.grapes],
  [/bread|loaf|toast/i, IMG.bread],
  [/croissant|pastry/i, IMG.croissant],
  [/muffin|cake|snack/i, IMG.muffin],
  [/butter|margarine|spread/i, IMG.butter],
  [/cheese/i, IMG.cheese],
  [/milk|dairy|yogurt/i, IMG.milk],
  [/honey|jam|oil|palm\s*oil/i, IMG.honey],
  [/pasta|spaghetti|macaroni|noodles|indomie/i, IMG.pasta],
];

export function illustrationForItem(name: string): ImageSourcePropType {
  const n = (name || '').trim().toLowerCase();
  for (const [re, img] of KEYWORDS) if (re.test(n)) return img;
  return IMG.basket;
}
