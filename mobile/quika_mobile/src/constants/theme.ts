// Qyka palette, mirrored from frontend/tailwind.config.js + globals.css.
// Light only: the brand is cream and white, never a dark surface.
export const Colors = {
  primary: '#EE9A5A', // burnt peach: the CTA colour
  primaryDark: '#D9702F', // text / link accent (passes contrast on cream)
  success: '#A8AD5C', // olive: success only, used sparingly
  canvas: '#F0ECE0', // page background
  surface: '#FFFFFF',
  sunken: '#F0EEEB',
  line: '#E0DDD3',
  ink: '#1A1A1A',
  muted: '#4A4A4A',
  faint: '#9B9B9B',
  danger: '#B3261E',
} as const;

export const Spacing = { one: 4, two: 8, three: 16, four: 24, five: 32, six: 48 } as const;
export const Radius = { md: 12, lg: 16, pill: 999 } as const;
