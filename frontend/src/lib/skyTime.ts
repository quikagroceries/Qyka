// Time-of-day model for the marketing hero sky.
//
// Everything is a pure function of a fractional local hour (0-24), so the
// scene can be scrubbed and tested without waiting for the clock. Every
// phase stays LIGHT: night is a soft lavender-cream, never a dark surface
// (Qyka has no dark surfaces anywhere). Only the sky carries the mood; the
// brand's cream/peach/olive roles are untouched.

type Rgb = [number, number, number];

const hex = (s: string): Rgb => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const css = (c: Rgb, alpha?: number) =>
  alpha === undefined
    ? `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`
    : `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])} / ${alpha})`;
const smooth = (t: number) => t * t * (3 - 2 * t);
export const smoothstep = (a: number, b: number, v: number) =>
  smooth(Math.min(1, Math.max(0, (v - a) / (b - a))));

type Stop = {
  h: number;
  /** sky colour at the very top of the hero */
  top: string;
  /** sky colour mid-way down */
  mid: string;
  /** sky colour at the rooftops */
  hor: string;
  /** the sun disc */
  sun: string;
  /** soft halo around the sun */
  glow: string;
  /** multiply-tint laid over the street so it catches the light */
  tint: string;
  /** 0 = full daylight, 1 = full night (drives stars and moon) */
  night: number;
};

// Day (11-15h) is exactly the page's cream canvas, so at midday the hero
// looks like it always did and the sun + clouds are the only change.
const STOPS: Stop[] = [
  { h: 0, top: "#D8D3EC", mid: "#E6DCEF", hor: "#F3E4E9", sun: "#F08B52", glow: "#F4B48A", tint: "#D9D2EA", night: 1 },
  { h: 4.5, top: "#D8D3EC", mid: "#E6DCEF", hor: "#F3E4E9", sun: "#F08B52", glow: "#F4B48A", tint: "#D9D2EA", night: 1 },
  { h: 5.75, top: "#E0D3E8", mid: "#F2D6DA", hor: "#F9D6BC", sun: "#F08B52", glow: "#F4B48A", tint: "#EBD6DC", night: 0.6 },
  { h: 6.75, top: "#F4CDBE", mid: "#F9D3AE", hor: "#FBD59A", sun: "#F08B52", glow: "#F7B77E", tint: "#FFE0C6", night: 0.1 },
  { h: 8.5, top: "#F3E4D2", mid: "#F1E2CA", hor: "#F5DDB8", sun: "#F2A062", glow: "#F6C79B", tint: "#FFF3E4", night: 0 },
  // Midday the sun is behind the headline, so it goes pale to keep the burnt-peach words readable.
  { h: 10.5, top: "#F0ECE0", mid: "#F0ECE0", hor: "#F5E9D2", sun: "#F7D0A8", glow: "#F8DEC2", tint: "#FFFFFF", night: 0 },
  { h: 14.5, top: "#F0ECE0", mid: "#F0ECE0", hor: "#F5E9D2", sun: "#F7D0A8", glow: "#F8DEC2", tint: "#FFFFFF", night: 0 },
  { h: 16, top: "#F1E8D4", mid: "#F3E0C2", hor: "#F7DBB6", sun: "#F4B07A", glow: "#F7C99B", tint: "#FFF0DC", night: 0 },
  { h: 16.75, top: "#F3E2C8", mid: "#F7D9AE", hor: "#F9CD94", sun: "#F29A58", glow: "#F7BC86", tint: "#FFE9CE", night: 0 },
  { h: 18, top: "#EDBFA9", mid: "#F4AC8A", hor: "#F7B473", sun: "#EC7446", glow: "#F29A6C", tint: "#FFD2B0", night: 0.05 },
  { h: 19, top: "#E2C6CF", mid: "#EDC0B4", hor: "#F4C8A2", sun: "#EC7446", glow: "#F29A6C", tint: "#EBD0CF", night: 0.4 },
  { h: 20, top: "#CFC7E4", mid: "#E3CEDC", hor: "#F1DAD4", sun: "#EC7446", glow: "#F29A6C", tint: "#DDD1E3", night: 0.8 },
  { h: 21, top: "#D8D3EC", mid: "#E6DCEF", hor: "#F3E4E9", sun: "#F08B52", glow: "#F4B48A", tint: "#D9D2EA", night: 1 },
  { h: 24, top: "#D8D3EC", mid: "#E6DCEF", hor: "#F3E4E9", sun: "#F08B52", glow: "#F4B48A", tint: "#D9D2EA", night: 1 },
];

// The sun is up 6:00-19:00, the moon 18:30-06:30. Both cross the same gap
// between the two rows of buildings and are hidden behind the rooftops while
// they are rising and setting, so "sunrise" really is the sun coming up from
// behind the street.
const SUN_RISE = 6;
const SUN_SET = 19;
const MOON_RISE = 18.5;
const MOON_SET = 30.5; // 06:30 next morning

// Positions are fractions of the 16:9 street scene (0-1, y can sit near 0 =
// the rooftop-level sky above the street). The arc is wide on purpose: the
// hero text covers the middle of the sky, so the sun rises over the left
// rooftops, passes behind the headline, and sets over the right rooftops.
// Rooftops run from y~0.08 at the scene's edges to y~0.5 in the middle, so
// at the arc's ends (x 0.14 / 0.86, y 0.34) the sun is still hidden behind
// the buildings.
const HORIZON_Y = 0.34;
const APEX_Y = 0.03;
const ARC_HALF_WIDTH = 0.36;

function arc(p: number, halfWidth: number) {
  return {
    x: 0.5 - halfWidth * Math.cos(Math.PI * p),
    y: HORIZON_Y - Math.sin(Math.PI * p) * (HORIZON_Y - APEX_Y),
  };
}

export type SkyState = {
  top: string;
  mid: string;
  hor: string;
  sun: string;
  glow: string;
  tint: string;
  night: number;
  starsOpacity: number;
  cloudOpacity: number;
  sunBody: { x: number; y: number; scale: number; visible: boolean };
  moonBody: { x: number; y: number; visible: boolean };
};

/** `arcHalfWidth` lets narrower screens push the sun/moon further out, clear of the text column. */
export function skyAt(hourIn: number, arcHalfWidth = ARC_HALF_WIDTH): SkyState {
  const h = ((hourIn % 24) + 24) % 24;
  let i = 0;
  while (i < STOPS.length - 2 && h >= STOPS[i + 1].h) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const t = smooth((h - a.h) / (b.h - a.h));
  const c = (k: "top" | "mid" | "hor" | "sun" | "glow" | "tint") => mix(hex(a[k]), hex(b[k]), t);
  const night = a.night + (b.night - a.night) * t;

  const sp = (h - SUN_RISE) / (SUN_SET - SUN_RISE);
  const sunUp = sp > 0 && sp < 1;
  const sunPos = arc(Math.min(1, Math.max(0, sp)), arcHalfWidth);
  // a touch bigger near the horizon, like the real thing
  const sunScale = 1 + 0.16 * (1 - Math.sin(Math.PI * Math.min(1, Math.max(0, sp))));

  const hn = h < MOON_RISE - 12 ? h + 24 : h;
  const mp = (hn - MOON_RISE) / (MOON_SET - MOON_RISE);
  const moonUp = mp > 0 && mp < 1;
  const moonPos = arc(Math.min(1, Math.max(0, mp)), arcHalfWidth);

  return {
    top: css(c("top")),
    mid: css(c("mid")),
    hor: css(c("hor")),
    sun: css(c("sun")),
    glow: css(c("glow")),
    tint: css(c("tint")),
    night,
    starsOpacity: smoothstep(0.35, 0.95, night),
    cloudOpacity: 1 - 0.3 * night,
    sunBody: { ...sunPos, scale: sunScale, visible: sunUp },
    moonBody: { ...moonPos, visible: moonUp },
  };
}

export const formatHour = (h: number) => {
  const m = Math.round((((h % 24) + 24) % 24) * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
