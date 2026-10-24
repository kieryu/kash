import type { EngineDebt } from '@/engine/types';

import { parseDebtForm, templatesFor, type DebtFormValues } from '../debtForm';
import { annualFromMonthly, durationText, formatMoney, formatYearMonth, parseMoney, parsePercent } from '../format';
import { budgetRange, canAddDebt, minimumsFloor } from '../plan';

describe('money and percent parsing', () => {
  it('reads typed amounts into minor units per currency', () => {
    expect(parseMoney('18,450.00', 'PHP')).toBe(1_845_000);
    expect(parseMoney('₱18,450', 'PHP')).toBe(1_845_000);
    expect(parseMoney('0.5', 'PHP')).toBe(50);
    expect(parseMoney('1500', 'JPY')).toBe(1500);
    expect(parseMoney('1.5', 'JPY')).toBeNull();
    expect(parseMoney('1.234', 'KWD')).toBe(1234);
    expect(parseMoney('1.001', 'PHP')).toBeNull();
    expect(parseMoney('', 'PHP')).toBeNull();
    expect(parseMoney('1.2.3', 'PHP')).toBeNull();
  });

  it('reads percents as decimal strings', () => {
    expect(parsePercent('3.00%')).toBe('0.03');
    expect(parsePercent('3.5')).toBe('0.035');
    expect(parsePercent('abc')).toBeNull();
    expect(annualFromMonthly('0.035')).toBe('0.42');
  });

  it('formats money and dates', () => {
    expect(formatMoney(1_845_000, 'PHP', 'en-PH')).toBe('₱18,450');
    expect(formatMoney(1_845_050, 'PHP', 'en-PH')).toBe('₱18,450.50');
    expect(formatYearMonth('2028-03', 'en-PH')).toBe('March 2028');
    expect(durationText(29)).toBe('in about 2 years 5 months');
    expect(durationText(12)).toBe('in about 1 year');
  });
});

const card: DebtFormValues = {
  segment: 'card',
  templateId: 'bdo-visa',
  color: '#1c3d73',
  nickname: ' Everyday Card ',
  balance: '18,450.00',
  rate: '3%',
  minimum: '850',
  payment: '',
  monthsLeft: '',
  dueDay: '28',
};

describe('parseDebtForm', () => {
  it('builds a revolving card', () => {
    const r = parseDebtForm(card, 'PHP');
    expect(r).toEqual({
      ok: true,
      openingMinor: 1_845_000,
      debt: expect.objectContaining({
        nickname: 'Everyday Card',
        kind: 'credit_card',
        issuer: 'BDO',
        color: '#1C3D73',
        monthlyRate: '0.03',
        minRule: 'fixed',
        minFixedMinor: 85_000,
        acceptsExtra: true,
        dueDay: 28,
      }),
    });
  });

  it('accepts a percent minimum', () => {
    const r = parseDebtForm({ ...card, minimum: '3%' }, 'PHP');
    expect(r.ok && r.debt).toMatchObject({ minRule: 'percent', minPercent: '0.03' });
  });

  it('builds an installment from payment × months left (D4)', () => {
    const r = parseDebtForm({ ...card, segment: 'installment', payment: '2,500', monthsLeft: '6' }, 'PHP');
    expect(r).toMatchObject({
      ok: true,
      openingMinor: 1_500_000,
      debt: { kind: 'card_installment', amortizationMinor: 250_000, interestMethod: 'baked_in', acceptsExtra: false, monthlyRate: '0' },
    });
    expect(r.ok && r.debt.minRule).toBeUndefined();
  });

  it('lets "other" debts skip rate and minimum', () => {
    const r = parseDebtForm({ ...card, segment: 'other', templateId: 'family-loan', rate: '', minimum: '', dueDay: '' }, 'PHP');
    expect(r).toMatchObject({ ok: true, debt: { kind: 'informal', monthlyRate: '0', minRule: 'fixed', minFixedMinor: 0, dueDay: null } });
  });

  it('reports each bad field', () => {
    const r = parseDebtForm({ ...card, nickname: '4111 1111 1111 1111', balance: 'x', rate: '', minimum: '', dueDay: '32', color: 'red' }, 'PHP');
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['balance', 'color', 'dueDay', 'minimum', 'nickname', 'rate']);
  });

  it('requires a due day for cards only', () => {
    expect(parseDebtForm({ ...card, dueDay: '' }, 'PHP').ok).toBe(false);
    expect(parseDebtForm({ ...card, segment: 'loan', templateId: 'sss', payment: '1000', monthsLeft: '12', dueDay: '' }, 'PHP')).toMatchObject({
      ok: true,
      debt: { kind: 'government_loan' },
    });
  });

  it('lists templates per segment with Custom last', () => {
    const loan = templatesFor('loan').map((t) => t.id);
    expect(loan).toEqual(['sss', 'pagibig', 'personal-loan', 'custom']);
  });
});

describe('budget', () => {
  const debt = (id: string, balance: number, amount: number): EngineDebt => ({
    id,
    currency: 'PHP',
    balance,
    monthlyRate: '0.03',
    acceptsExtra: true,
    createdSeq: 0,
    kind: 'revolving',
    minimum: { kind: 'fixed', amount },
  });

  it('floor = sum of this month’s minimums, capped at each balance', () => {
    expect(minimumsFloor([debt('a', 100_000, 85_000), debt('b', 20_000, 50_000)])).toBe(105_000);
  });

  it('range starts at the floor rounded up to a step, or the saved budget', () => {
    expect(budgetRange(531_500, 50_000, null)).toEqual({ min: 531_500, max: 2_150_000, start: 550_000 });
    expect(budgetRange(531_500, 50_000, 1_000_000).start).toBe(1_000_000);
    expect(budgetRange(531_500, 50_000, 100).start).toBe(550_000);
  });

  it('free tier allows 3 debts', () => {
    expect(canAddDebt(2, false)).toBe(true);
    expect(canAddDebt(3, false)).toBe(false);
    expect(canAddDebt(3, true)).toBe(true);
  });
});
