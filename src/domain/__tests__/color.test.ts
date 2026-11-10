import { contrastWithWhite, hexToHsl, hslToHex, maxLightness, MIN_LIGHTNESS, pickerColor, pickerPosition, pickerStart } from '../color';

describe('card color picker math', () => {
  it('converts HSL to hex and back', () => {
    expect(hslToHex(0, 100, 50)).toBe('#FF0000');
    expect(hslToHex(120, 100, 25)).toBe('#008000');
    expect(hslToHex(0, 0, 100)).toBe('#FFFFFF');
    const { h, s, l } = hexToHsl('#1E5B47');
    expect(hslToHex(h, s, l)).toBe('#1E5B47');
  });

  it('keeps white card text readable on every hue and shade', () => {
    for (let hue = 0; hue < 360; hue += 5) {
      for (const shade of [0, 50, 100]) expect(contrastWithWhite(pickerColor(hue, shade))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('lets blues go lighter than yellows', () => {
    expect(maxLightness(220)).toBeGreaterThan(maxLightness(60));
    expect(maxLightness(60)).toBeGreaterThanOrEqual(MIN_LIGHTNESS);
  });

  it('keeps the darkest shade colorful, not black', () => {
    for (let hue = 0; hue < 360; hue += 30) expect(hexToHsl(pickerColor(hue, 100)).l).toBeGreaterThanOrEqual(19.5);
  });

  it('starts black or gray at a visible color, not the dark end (stuck-in-black bug)', () => {
    const start = pickerStart('#2B2B2B');
    expect(start.shade).toBeLessThanOrEqual(50);
    expect(hexToHsl(pickerColor(start.hue, start.shade)).s).toBeGreaterThan(40);
    // A colored swatch starts at its own hue.
    expect(Math.abs(pickerStart('#1C3D73').hue - hexToHsl('#1C3D73').h)).toBeLessThan(1);
    // A color made by the picker comes back exactly.
    expect(pickerStart(pickerColor(200, 40))).toEqual({ hue: 200, shade: 40 });
  });

  it('places a picked color back on the same slider spot', () => {
    const hex = pickerColor(200, 40);
    expect(pickerPosition(hex)).toEqual({ hue: 200, shade: 40 });
    expect(pickerColor(pickerPosition(hex).hue, pickerPosition(hex).shade)).toBe(hex);
  });
});
