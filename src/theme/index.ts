import { cardSwatches, colors, mascotColors, opacity, radius, size, space } from './tokens';
import { fontFamily, type } from './typography';

export const theme = { colors, cardSwatches, mascotColors, opacity, space, radius, size, type, fontFamily } as const;
export type Theme = typeof theme;

// Light mode only for MVP (DECISIONS.md D7). Components read the theme through this hook
// so a dark palette can be swapped in later without touching them.
export function useTheme(): Theme {
  return theme;
}

export * from './tokens';
export * from './typography';
