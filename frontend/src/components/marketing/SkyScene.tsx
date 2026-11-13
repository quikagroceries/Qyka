"use client";

// The hero's living sky: a gradient, a sun and moon on a real arc, drifting
// clouds by day, stars by night, all driven by the visitor's local
// time. The street illustration sits in front with its sky cut out, so the
// sun rises from behind the rooftops and sets behind them.
//
// Preview any time of day without waiting:
//   ?hour=17.5      freeze the scene at 17:30
//   ?skydebug       show a scrubber to slide through the whole day

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

import { formatHour, skyAt, smoothstep } from "@/lib/skyTime";

import street from "@/assets/illustrations/hero-street-sky.webp";
import cloudRound from "@/assets/illustrations/sky-cloud-round.webp";
import cloudFlat from "@/assets/illustrations/sky-cloud-flat.webp";
import cloudSmall from "@/assets/illustrations/sky-cloud-small.webp";
import cloudPuffy from "@/assets/illustrations/sky-cloud-puffy.webp";
import starL from "@/assets/illustrations/sky-star-l.webp";
import starM from "@/assets/illustrations/sky-star-m.webp";
import starS from "@/assets/illustrations/sky-star-s.webp";

// x/y are % of the street scene; w is in cqw (% of the scene's width).
// The hero text covers the middle of the sky, so everything that drifts or
// twinkles lives in the two open pockets above the rooftops (x < 26% and
// x > 74%) and is faded out over the text column (see POCKET_MASK).
// Negative delays spread the loops so the sky is already populated on load.
const CLOUDS = [
  { src: cloudRound, y: 4, w: 10, dur: 190, delay: -39 },
  { src: cloudFlat, y: 14, w: 12, dur: 270, delay: -215 },
  { src: cloudSmall, y: 1, w: 5.5, dur: 150, delay: -45 },
  { src: cloudPuffy, y: 18, w: 8, dur: 320, delay: -234 },
];

const STARS = [
  { src: starL, x: 8, y: 6, w: 4.6, dur: 3.4, delay: 0 },
  { src: starM, x: 18, y: 14, w: 4.8, dur: 4.2, delay: -1.2 },
  { src: starS, x: 12, y: 21, w: 4, dur: 3.1, delay: -2.1 },
  { src: starL, x: 90, y: 7, w: 4.4, dur: 4.4, delay: -1.7 },
  { src: starS, x: 81, y: 4, w: 3.8, dur: 4.8, delay: -0.6 },
  { src: starM, x: 86, y: 18, w: 4.4, dur: 3.9, delay: -2.8 },
];

// Fades whatever is inside to nothing across the hero's text column. The
// column is a roughly fixed width (the headline caps at ~680px), so the clear
// zone is measured in px from the centre, not as a % of the screen.
const POCKET_MASK =
  "linear-gradient(to right, #000 calc(50% - 460px), transparent calc(50% - 370px), transparent calc(50% + 370px), #000 calc(50% + 460px))";

// Crescent: two circular arcs (outer r38, inner bite r33), traced by hand.
const MOON_PATH = "M48.15 12.05 A38 38 0 1 0 84.33 66.29 A33 33 0 1 1 48.15 12.05 Z";

export default function SkyScene() {
  const reduce = useReducedMotion();
  const [hour, setHour] = useState<number | null>(null);
  const [debug, setDebug] = useState(false);

  // Time is read after mount so server and client markup agree; the scene
  // fades in once it knows the hour (no flash from noon to the real colour).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const clock = () => {
      const d = new Date();
      return d.getHours() + d.getMinutes() / 60;
    };
    const forced = q.get("hour");
    const isDebug = q.has("skydebug");
    setDebug(isDebug);
    if (forced !== null && forced !== "" && !Number.isNaN(Number(forced))) {
      setHour(Number(forced));
      return;
    }
    setHour(clock());
    if (isDebug) return;
    const id = setInterval(() => setHour(clock()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Light pointer parallax: far layers drift a few px against the street.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  useEffect(() => {
    if (reduce || !window.matchMedia("(hover: hover)").matches) return;
    const move = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, px, py]);
  const spring = { stiffness: 60, damping: 20, mass: 0.6 };
  const farX = useSpring(useTransform(px, (v) => v * -7), spring);
  const farY = useSpring(useTransform(py, (v) => v * -4), spring);
  const midX = useSpring(useTransform(px, (v) => v * -14), spring);
  const midY = useSpring(useTransform(py, (v) => v * -7), spring);

  // Narrow screens have less open sky either side of the text, so the sun and
  // moon swing wider to stay clear of it.
  const [viewW, setViewW] = useState(1440);
  useEffect(() => {
    const read = () => setViewW(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  const arcHalfWidth = Math.min(0.46, Math.max(0.4, 520 / viewW));

  const ready = hour !== null;
  const s = skyAt(hour ?? 12, arcHalfWidth);
  // The moon's dark outline would cut through the headline, so while it is
  // behind the text column it fades to a faint ghost and is crisp again once
  // it reaches the open sky on either side.
  const moonFade = 0.22 + 0.78 * smoothstep(0.1, 0.24, Math.abs(s.moonBody.x - 0.5));

  return (
    <>
      {/* Solid sky-top colour behind the whole hero (and the transparent nav)
          so the gradient below starts seamlessly. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 transition-colors duration-1000"
        style={{ backgroundColor: s.top }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[min(115vw,calc(100%-14rem))] sm:h-[min(56.25vw,calc(100%-14rem))]"
        // Clip the sides and bottom (the street is cropped there) but NOT the
        // top, so the sun's halo can spill up into the hero instead of being
        // cut off in a hard horizontal edge.
        style={{ containerType: "size", clipPath: "inset(-100vh 0 0 0)" }}
      >
        {/* The scene keeps the street's 16:9 shape and covers the box like
            object-cover/object-top, so sun, clouds and rooftops always line
            up whatever the viewport. cqw below = % of this scene's width. */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            width: "max(100cqw, 100cqh * 16 / 9)",
            aspectRatio: "16 / 9",
            containerType: "inline-size",
          }}
        >
          {/* sky gradient: top colour -> mid -> rooftops */}
          <div
            className="absolute inset-0 transition-opacity duration-1000"
            style={{
              opacity: ready ? 1 : 0,
              background: `linear-gradient(to bottom, ${s.top} 0%, ${s.mid} 16%, ${s.hor} 36%)`,
            }}
          />

          <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: ready ? 1 : 0 }}>
            {/* stars */}
            <motion.div className="absolute inset-0" style={{ x: farX, y: farY, opacity: s.starsOpacity }}>
              {STARS.map((st, i) => (
                <Image
                  key={i}
                  src={st.src}
                  alt=""
                  className="sky-twinkle absolute"
                  style={{
                    left: `${st.x}%`,
                    top: `${st.y}%`,
                    width: `${st.w}cqw`,
                    height: "auto",
                    animationDuration: `${st.dur}s`,
                    animationDelay: `${st.delay}s`,
                  }}
                />
              ))}
            </motion.div>

            {/* sun: soft breathing halo + flat disc */}
            <motion.div className="absolute inset-0" style={{ x: farX, y: farY }}>
              <div
                className="absolute transition-opacity duration-700"
                style={{
                  left: `${s.sunBody.x * 100}%`,
                  top: `${s.sunBody.y * 100}%`,
                  opacity: s.sunBody.visible ? 1 : 0,
                }}
              >
                <div
                  className="sky-breathe absolute left-0 top-0 rounded-full"
                  style={{
                    width: "64cqw",
                    height: "64cqw",
                    background: `radial-gradient(closest-side, ${s.glow} 0%, ${s.glow} 12%, transparent 100%)`,
                  }}
                />
                <div
                  className="absolute left-0 top-0 rounded-full"
                  style={{
                    width: "7.4cqw",
                    height: "7.4cqw",
                    transform: `translate(-50%, -50%) scale(${s.sunBody.scale})`,
                    background: s.sun,
                  }}
                />
              </div>

              {/* moon */}
              <div
                className="absolute transition-opacity duration-700"
                style={{
                  left: `${s.moonBody.x * 100}%`,
                  top: `${s.moonBody.y * 100}%`,
                  opacity: s.moonBody.visible ? s.starsOpacity * moonFade : 0,
                }}
              >
                <div
                  className="absolute left-0 top-0 rounded-full"
                  style={{
                    width: "15cqw",
                    height: "15cqw",
                    transform: "translate(-50%, -50%)",
                    background: "radial-gradient(closest-side, rgba(255,246,224,0.9), transparent)",
                  }}
                />
                <svg
                  viewBox="0 0 100 100"
                  className="absolute left-0 top-0"
                  style={{ width: "8cqw", height: "8cqw", transform: "translate(-50%, -50%) rotate(-18deg)" }}
                >
                  <path d={MOON_PATH} fill="#FBF1D6" stroke="#2B2A2E" strokeWidth="2.4" strokeLinejoin="round" />
                </svg>
              </div>
            </motion.div>

            {/* clouds */}
            <motion.div className="absolute inset-0" style={{ x: midX, y: midY, opacity: s.cloudOpacity, WebkitMaskImage: POCKET_MASK, maskImage: POCKET_MASK }}>
              {CLOUDS.map((c, i) => (
                <div
                  key={i}
                  className="sky-drift absolute left-0"
                  style={{ top: `${c.y}%`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
                >
                  <Image src={c.src} alt="" style={{ width: `${c.w}cqw`, height: "auto" }} />
                </div>
              ))}
            </motion.div>
          </div>

          {/* the street: its sky is transparent, so everything above sits behind it */}
          <Image src={street} alt="" fill sizes="100vw" quality={85} priority className="object-fill" />

          {/* light falling on the street: a multiply tint clipped to the street's own shape */}
          <div
            className="absolute inset-0 mix-blend-multiply transition-opacity duration-1000"
            style={{
              opacity: ready ? 1 : 0,
              backgroundColor: s.tint,
              WebkitMaskImage: `url(${street.src})`,
              maskImage: `url(${street.src})`,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
            }}
          />
        </div>
      </div>

      {debug && hour !== null && (
        <div className="pointer-events-auto fixed bottom-4 left-4 z-[60] flex items-center gap-3 rounded-full border border-line bg-white px-4 py-2 shadow-md">
          <span className="w-12 font-display text-sm font-bold tabular-nums text-ink">{formatHour(hour)}</span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.05}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            aria-label="Time of day"
            className="w-56 accent-[#EE9A5A]"
          />
        </div>
      )}
    </>
  );
}
