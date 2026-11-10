import type { EngineDebt } from '@/engine/types';

import { issuersFor, optionLabel, parseDebtForm, templatesFor, type DebtFormValues } from '../debtForm';
import { amountEdit, amountTyping, annualFromMonthly, durationText, formatMoney, formatYearMonth, parseMoney, parsePercent } from '../format';
import { budgetRange, budgetStepTo, canAddDebt, minimumsFloor } from '../plan';

describe('money and percent parsing', () => {
  it('formats money while typing (R19)', () => {
    expect(amountTyping('18450', 'PHP')).toBe('18,450');
    expect(amountTyping('1234567.', 'PHP')).toBe('1,234,567.');
    expect(amountTyping('18,450.5', 'PHP')).toBe('18,450.5');
    expect(amountTyping('18450.509', 'PHP')).toBe('18,450.50');
    expect(amountTyping('.5', 'PHP')).toBe('0.5');
    expect(amountTyping('007', 'PHP')).toBe('7');
    expect(amountTyping('₱1,0a00', 'PHP')).toBe('1,000');
    expect(amountTyping('1500.5', 'JPY')).toBe('1,500');
    expect(amountTyping('', 'PHP')).toBe('');
    // What the field shows reads back to the same amount.
    expect(parseMoney(amountTyping('1234567.89', 'PHP'), 'PHP')).toBe(123_456_789);
  });

  it('keeps the cursor next to the edit when commas move (R19)', () => {
    const edit = (prev: string, raw: string) => amountEdit(prev, raw, 'PHP');
    // Typing at the end: cursor stays at the end even when a comma appears.
    expect(edit('999', '9999')).toEqual({ text: '9,999', caret: 5 });
    // Insert after the "1" of 12,400 → 152,400, cursor after the 5.
    expect(edit('12,400', '152,400')).toEqual({ text: '152,400', caret: 2 });
    // Insert that adds a comma: 12|3,456 + "9" → 1,293,456, cursor after the 9.
    expect(edit('123,456', '1293,456')).toEqual({ text: '1,293,456', caret: 4 });
    // Delete a digit in the middle: 1,234,567 minus the "4" → 123,567, cursor after the 3.
    expect(edit('1,234,567', '1,23,567')).toEqual({ text: '123,567', caret: 3 });
    // Backspace right after a comma deletes the digit before it: 12,|400 → 1|,400 → 1,400.
    expect(edit('12,400', '12400')).toEqual({ text: '1,400', caret: 1 });
    // Decimals.
    expect(edit('1,000', '1,000.')).toEqual({ text: '1,000.', caret: 6 });
    expect(edit('', '5')).toEqual({ text: '5', caret: 1 });
  });

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
  issuer: '',
  balance: '18,450.00',
  rate: '3%',
  minimum: '850',
  payment: '',
  monthsLeft: '',
  dueDay: '28',
  statementDay: '',
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

  it('names an unnamed debt after its template; Custom needs a name', () => {
    expect(parseDebtForm({ ...card, nickname: ' ' }, 'PHP')).toMatchObject({ ok: true, debt: { nickname: 'BDO Visa' } });
    const custom = parseDebtForm({ ...card, templateId: 'custom', nickname: '' }, 'PHP');
    expect(!custom.ok && custom.errors.nickname).toBe('Give it a name you’ll recognise.');
  });

  it('lets a Custom debt name its issuer; templates keep their own (custom card name)', () => {
    const custom = { ...card, templateId: 'custom', nickname: 'Everyday', issuer: '  GCash GCredit ' };
    expect(parseDebtForm(custom, 'PHP')).toMatchObject({ ok: true, debt: { issuer: 'GCash GCredit' } });
    expect(parseDebtForm({ ...custom, issuer: ' ' }, 'PHP')).toMatchObject({ ok: true, debt: { issuer: null } });
    // A template ignores the free-text issuer.
    expect(parseDebtForm({ ...card, issuer: 'Ignored' }, 'PHP')).toMatchObject({ ok: true, debt: { issuer: 'BDO' } });
    const r = parseDebtForm({ ...custom, issuer: '4111 1111 1111 1111' }, 'PHP');
    expect(!r.ok && r.errors.issuer).toMatch(/card number/);
  });

  it('takes an optional statement day on cards only', () => {
    expect(parseDebtForm(card, 'PHP')).toMatchObject({ ok: true, debt: { statementDay: null } });
    expect(parseDebtForm({ ...card, statementDay: '15' }, 'PHP')).toMatchObject({ ok: true, debt: { statementDay: 15 } });
    const bad = parseDebtForm({ ...card, statementDay: '32' }, 'PHP');
    expect(!bad.ok && bad.errors.statementDay).toMatch(/1 to 31/);
    const loan = { ...card, segment: 'loan' as const, templateId: 'sss', payment: '1000', monthsLeft: '12', statementDay: '15' };
    expect(parseDebtForm(loan, 'PHP')).toMatchObject({ ok: true, debt: { statementDay: null } });
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

  it('groups card templates by bank for the dropdown, Custom last (R16)', () => {
    const banks = issuersFor('card');
    expect(banks[0]).toMatchObject({ issuer: 'BDO' });
    expect(banks[0].templates.map((t) => t.id)).toEqual(['bdo-visa', 'bdo-mc']);
    expect(banks.at(-1)).toMatchObject({ issuer: 'Custom' });
    expect(new Set(banks.map((b) => b.issuer)).size).toBe(banks.length);
    expect(banks.flatMap((b) => b.templates)).toHaveLength(templatesFor('card').length);
  });

  it('labels network options, adding the product only when a bank has two on one network (R15)', () => {
    const ub = issuersFor('card').find((b) => b.issuer === 'UnionBank')!.templates;
    expect(ub.map((t) => optionLabel(t, ub))).toEqual(['Visa', 'Mastercard', 'Visa (ex-Citi)']);
    const rcbc = issuersFor('card').find((b) => b.issuer === 'RCBC')!.templates;
    expect(rcbc.map((t) => optionLabel(t, rcbc))).toEqual(['Visa', 'Mastercard', 'JCB']);
    const [sss] = templatesFor('loan');
    expect(optionLabel(sss, [sss])).toBe('Salary loan');
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

describe('budget −/+ (R22)', () => {
  const STEP = 50_000; // ₱500
  const FLOOR = 2_254_679; // ₱22,546.79 of minimums
  it('moves to the next round step, never below the minimums', () => {
    expect(budgetStepTo(FLOOR, 1, STEP, FLOOR)).toBe(2_300_000);
    expect(budgetStepTo(2_300_000, 1, STEP, FLOOR)).toBe(2_350_000);
    expect(budgetStepTo(2_300_000, -1, STEP, FLOOR)).toBe(FLOOR);
    expect(budgetStepTo(FLOOR, -1, STEP, FLOOR)).toBe(FLOOR);
    expect(budgetStepTo(2_412_345, -1, STEP, FLOOR)).toBe(2_400_000);
    expect(budgetStepTo(2_412_345, 1, STEP, FLOOR)).toBe(2_450_000);
  });
});
