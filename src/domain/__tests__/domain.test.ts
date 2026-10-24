import type { DebtRow } from '@/db/schema';

import { looksLikeCardNumber } from '../cardNumber';
import { installmentBalance, toEngineDebts } from '../engineDebts';

const row = (over: Partial<DebtRow>): DebtRow => ({
  id: 'a',
  nickname: 'Card',
  kind: 'credit_card',
  issuer: null,
  templateId: null,
  color: '#1C3D73',
  currency: 'PHP',
  monthlyRate: '0.03',
  rateEnteredAs: 'monthly',
  minRule: 'fixed',
  minPercent: null,
  minFixedMinor: 50_000,
  amortizationMinor: null,
  interestMethod: null,
  acceptsExtra: true,
  statementDay: null,
  dueDay: null,
  creditLimitMinor: null,
  lateFeeMinor: null,
  promoRate: null,
  promoEndsOn: null,
  autoDeducted: false,
  sortOrder: 0,
  notes: null,
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
  archivedAt: null,
  paidOffOn: null,
  ...over,
});

describe('toEngineDebts', () => {
  it('maps revolving minimum rules', () => {
    const [fixed, pct, both] = toEngineDebts(
      [
        row({ id: 'f', createdAt: '1' }),
        row({ id: 'p', createdAt: '2', minRule: 'percent', minPercent: '0.03', minFixedMinor: null }),
        row({ id: 'b', createdAt: '3', minRule: 'percent_or_fixed', minPercent: '0.03', minFixedMinor: 50_000 }),
      ],
      new Map([['f', 100]]),
    );
    expect(fixed).toMatchObject({ kind: 'revolving', balance: 100, minimum: { kind: 'fixed', amount: 50_000 } });
    expect(pct).toMatchObject({ balance: 0, minimum: { kind: 'percent', percent: '0.03' } });
    expect(both).toMatchObject({ minimum: { kind: 'percentOrFixed', percent: '0.03', floor: 50_000 } });
  });

  it('maps installments, promos and clamps overpaid balances', () => {
    const [d] = toEngineDebts(
      [
        row({
          minRule: null,
          minFixedMinor: null,
          amortizationMinor: 250_000,
          interestMethod: 'baked_in',
          acceptsExtra: false,
          promoRate: '0',
          promoEndsOn: '2027-03-15',
        }),
      ],
      new Map([['a', -500]]),
    );
    expect(d).toEqual({
      id: 'a',
      currency: 'PHP',
      balance: 0,
      monthlyRate: '0.03',
      promo: { monthlyRate: '0', until: '2027-03' },
      acceptsExtra: false,
      createdSeq: 0,
      kind: 'installment',
      payment: 250_000,
      interest: 'bakedIn',
    });
  });

  it('numbers createdSeq by creation time, not list order', () => {
    const debts = toEngineDebts([row({ id: 'late', createdAt: '2' }), row({ id: 'early', createdAt: '1' })], new Map());
    expect(debts.map((d) => [d.id, d.createdSeq])).toEqual([
      ['early', 0],
      ['late', 1],
    ]);
  });

  it('refuses an incomplete minimum rule', () => {
    expect(() => toEngineDebts([row({ minRule: 'percent', minPercent: null })], new Map())).toThrow(/minimum/);
  });

  it('computes baked-in installment balance', () => {
    expect(installmentBalance(250_000, 6)).toBe(1_500_000);
  });
});

describe('looksLikeCardNumber', () => {
  it.each(['4111111111111111', 'my card 4111 1111 1111 1111', '5500-0000-0000-0004', '378282246310005'])(
    'flags %s',
    (s) => expect(looksLikeCardNumber(s)).toBe(true),
  );

  it.each(['BDO Visa', '09171234567', '4111 1111 1111 1112', '₱18,450.00', 'ref 2026-10-24', ''])(
    'allows %s',
    (s) => expect(looksLikeCardNumber(s)).toBe(false),
  );
});
