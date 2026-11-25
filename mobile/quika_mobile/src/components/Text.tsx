import { Text as RNText, type TextProps } from 'react-native';

const HAS_FONT = /(^|\s)font-(body|normal|medium|semibold|bold|extrabold|display)(\s|$)/;

/**
 * Text that defaults to the web's body font (DM Sans). React Native doesn't
 * inherit fonts, so without this every un-weighted label would fall back to the
 * system font. A weight class (font-bold, font-extrabold...) picks its own.
 */
export function Text({ className, ...props }: TextProps & { className?: string }) {
  const cls = className ?? '';
  return <RNText {...props} className={HAS_FONT.test(cls) ? cls : `font-body ${cls}`.trim()} />;
}
