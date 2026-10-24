import { DEBT_KINDS } from '@/db/schema';

import templates from '../cardTemplates.json';

// Catalog is data, edited by hand (§18): catch typos before they reach the picker.
describe('card templates', () => {
  it('has unique ids', () => {
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
  });

  it.each(templates)('$id is well-formed', (t) => {
    expect(t.color).toMatch(/^#[0-9A-F]{6}$/);
    expect(DEBT_KINDS).toContain(t.kind);
    expect([null, 'Visa', 'Mastercard', 'JCB', 'Amex']).toContain(t.network);
    expect(t.issuer.trim()).not.toBe('');
  });
});
