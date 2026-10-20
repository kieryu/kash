import { cardSwatches, colors, mascotColors } from '../tokens';
import { fontFamily, type } from '../typography';

const HEX = /^#[0-9A-F]{6}$/;

describe('theme tokens', () => {
  it('uses 6-digit uppercase hex for every color', () => {
    for (const [name, value] of Object.entries({ ...colors, ...mascotColors })) {
      expect({ name, value }).toEqual({ name, value: expect.stringMatching(HEX) });
    }
    cardSwatches.forEach((c) => expect(c).toMatch(HEX));
  });

  it('matches the core palette in design/DESIGN.md', () => {
    expect(colors).toMatchObject({
      bg: '#F3F5EF',
      ink: '#142019',
      primary: '#1E5B47',
      accent: '#E9A23B',
      danger: '#A3361C',
    });
  });

  it('uses DM Sans for every text style', () => {
    const families = new Set<string>(Object.values(fontFamily));
    for (const style of Object.values(type)) {
      expect(families.has(style.fontFamily as string)).toBe(true);
    }
  });
});
