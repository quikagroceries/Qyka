/** Mirrors frontend/tailwind.config.js (light theme resolved to concrete values:
 *  the web tokens are CSS variables; the mobile app is light only). */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#EE9A5A',
          'orange-dark': '#D9702F',
          green: '#A8AD5C',
          'green-dark': '#8F9448',
          // Army green: the readable, darker partner of the olive. Text, icons and small marks for
          // "done and trustworthy" states; olive stays as the light tint behind it. Never a CTA.
          army: '#4F5B2E',
        },
        gold: '#F6C4A0',
        ink: '#1A1A1A',
        canvas: '#F0ECE0',
        'canvas-deep': '#E5DECD',
        chalk: '#F4F0E6',
        surface: '#FFFFFF',
        'surface-2': '#FDFAF5',
        sunken: '#F0EEEB',
        'sunken-2': '#F7F5F2',
        line: '#EEEEE8',
        'line-strong': '#E0DDD3',
        muted: '#4A4A4A',
        faint: '#9B9B9B',
        danger: '#B3261E',
      },
      borderRadius: {
        '2xl': '16px',
        shop: '20px',
        'shop-lg': '24px',
      },
    },
  },
  // RN picks a font file per weight, so the weight utilities choose the family
  // (the web's DM Sans body + Bricolage Grotesque display) instead of a weight.
  corePlugins: { fontWeight: false },
  plugins: [
    require('tailwindcss/plugin')(({ addUtilities }) => {
      addUtilities({
        '.font-body': { fontFamily: 'DMSans_400Regular' },
        '.font-normal': { fontFamily: 'DMSans_400Regular' },
        '.font-medium': { fontFamily: 'DMSans_500Medium' },
        '.font-semibold': { fontFamily: 'DMSans_600SemiBold' },
        '.font-bold': { fontFamily: 'DMSans_700Bold' },
        '.font-extrabold': { fontFamily: 'BricolageGrotesque_800ExtraBold' },
        '.font-display': { fontFamily: 'BricolageGrotesque_700Bold' },
      });
    }),
  ],
};
