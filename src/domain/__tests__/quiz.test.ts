import { recommend } from '../quiz';

describe('help me choose quiz', () => {
  it('maps answers to a free strategy', () => {
    expect(recommend('wins', false)).toBe('snowball');
    expect(recommend('savings', false)).toBe('avalanche');
    // "Yes, I have my own order" wins over Q1.
    expect(recommend('wins', true)).toBe('custom');
    expect(recommend('savings', true)).toBe('custom');
  });
});
