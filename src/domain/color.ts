// Card color picker math (custom card colors). Pure: no React.

/** Fixed saturation for picked colors: rich enough to look like a card, never neon. */
export const PICKER_SATURATION = 55;
/** Darkest shade offered (lightness %). Darker than ~20% every hue looks black. */
export const MIN_LIGHTNESS = 20;
/** White card text must stay readable on the picked color (WCAG AA for normal text). */
const MIN_CONTRAST = 4.5;

/** HSL (h 0–360, s and l 0–100) → "#RRGGBB". */
export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

/** "#RRGGBB" → HSL (h 0–360, s and l 0–100). */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

/** Contrast ratio of white text on a "#RRGGBB" background (1–21). */
export function contrastWithWhite(hex: string): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (lum + 0.05);
}

/** Lightest shade of a hue that still keeps white text readable. Yellows stop darker than blues. */
export function maxLightness(h: number): number {
  let l = 50;
  while (l > MIN_LIGHTNESS && contrastWithWhite(hslToHex(h, PICKER_SATURATION, l)) < MIN_CONTRAST) l -= 1;
  return l;
}

/** Shade slider 0 (lightest allowed) … 100 (darkest) → the card color. */
export function pickerColor(hue: number, shade: number): string {
  const top = maxLightness(hue);
  return hslToHex(hue, PICKER_SATURATION, top - ((top - MIN_LIGHTNESS) * shade) / 100);
}

/** Where the picker opens. Black and grays have no hue, so they start at a mid green instead of the dark end. */
export function pickerStart(hex: string): { hue: number; shade: number } {
  if (hexToHsl(hex).s < 20) return { hue: 160, shade: 40 };
  return pickerPosition(hex);
}

/** Where an existing color sits on the picker, so editing a saved custom color starts there. */
export function pickerPosition(hex: string): { hue: number; shade: number } {
  const { h, l } = hexToHsl(hex);
  const hue = Math.round(h) % 360;
  const top = maxLightness(hue);
  const shade = top > MIN_LIGHTNESS ? ((top - l) / (top - MIN_LIGHTNESS)) * 100 : 100;
  return { hue, shade: Math.round(Math.min(100, Math.max(0, shade))) };
}
