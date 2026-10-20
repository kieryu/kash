import type { TextStyle } from 'react-native';

// DM Sans only. Android can't pick a weight from one custom family, so each weight is its own family.
export const fontFamily = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
} as const;

const style = (fontSize: number, family: keyof typeof fontFamily, extra: TextStyle = {}): TextStyle => ({
  fontFamily: fontFamily[family],
  fontSize,
  ...extra,
});

// Named text styles from design/DESIGN.md §1 "Typography".
export const type = {
  wordmark: style(44, 'bold', { letterSpacing: -1 }),
  h1: style(26, 'bold', { lineHeight: 30, letterSpacing: -0.4 }),
  screenHeader: style(20, 'bold'),
  hero: style(26, 'bold'),
  sectionTitle: style(17, 'bold'),
  body: style(15, 'regular', { lineHeight: 22.5 }),
  rowTitle: style(15, 'bold'),
  rowTitleSm: style(14, 'bold'),
  small: style(13, 'regular'),
  label: style(13, 'bold'),
  caption: style(12, 'regular'),
  button: style(16, 'bold'),
  amountSm: style(20, 'bold'),
  amount: style(26, 'bold'),
  amountLg: style(32, 'bold'),
} as const satisfies Record<string, TextStyle>;

export type TypeToken = keyof typeof type;
