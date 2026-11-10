import { testDb } from '@/db/__tests__/testDb';
import { createDebt, getDebt, type NewDebt } from '@/db/repositories/debts';
import { updateSettings } from '@/db/repositories/settings';
import { balanceOf, listTransactions } from '@/db/repositories/transactions';
import type { Db } from '@/db/schema';
import type { PlanResult } from '@/engine/types';

import { loadSnapshot, type Snapshot } from '../dashboard';
import { savePayment } from '../payments';
import { canLogPurchase, purchaseImpact, purchasePreview, savePurchase } from '../purchase';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const card: NewDebt = {
  nickname: 'Travel Card',
  kind: 'credit_card',
  color: '#1C3D73',
  currency: 'PHP',
  monthlyRate: '0.03',
  rateEnteredAs: 'monthly',
  minRule: 'fixed',
  minFixedMinor: 85_000,
  acceptsExtra: true,
  autoDeducted: false,
  dueDay: 28,
  statementDay: 3,
};
const snap = (db: Db): Snapshot => ({ ...loadSnapshot(db), month: '2026-10' });

function setup() {
  const db = testDb();
  const id = createDebt(db, card, { balanceMinor: 2_300_000, on: '2026-10-01' });
  updateSettings(db, { budgetMinor: 500_000, strategy: 'snowball' });
  return { db, id };
}

const ok = (debtFree: string): PlanResult => ({ status: 'ok', months: [], debtFree, perDebt: {}, totals: { interest: 0, paid: 0 } });

describe('log a purchase (R24)', () => {
  it('is offered on revolving cards only', () => {
    expect(canLogPurchase({ kind: 'credit_card', amortizationMinor: null })).toBe(true);
    expect(canLogPurchase({ kind: 'card_installment', amortizationMinor: 250_000 })).toBe(false);
    expect(canLogPurchase({ kind: 'personal_loan', amortizationMinor: 500_000 })).toBe(false);
    expect(canLogPurchase({ kind: 'other', amortizationMinor: null })).toBe(false);
  });

  it('saves one charge row that raises the balance', () => {
    const { db, id } = setup();
    expect(savePurchase(db, id, 150_000, '2026-10-12')).toBe(false);
    expect(listTransactions(db, id)[0]).toMatchObject({ type: 'charge', amountMinor: 150_000, occurredOn: '2026-10-12' });
    expect(balanceOf(db, id)).toBe(2_450_000);
  });

  it('refuses zero, negative and fractional amounts', () => {
    const { db, id } = setup();
    expect(() => savePurchase(db, id, 0, '2026-10-12')).toThrow();
    expect(() => savePurchase(db, id, -100, '2026-10-12')).toThrow();
    expect(() => savePurchase(db, id, 10.5, '2026-10-12')).toThrow();
  });

  it('puts a paid-off card back in the plan', () => {
    const { db, id } = setup();
    expect(savePayment(db, { debtId: id, mode: 'planned' }, 2_300_000, '2026-10', '2026-10-05')).toBe(true);
    expect(getDebt(db, id)!.paidOffOn).toBe('2026-10-05');
    expect(savePurchase(db, id, 50_000, '2026-10-12')).toBe(true);
    expect(getDebt(db, id)!.paidOffOn).toBeNull();
  });

  it('previews the plan with the purchase, matching what gets saved', () => {
    const { db, id } = setup();
    const { before, after } = purchasePreview(snap(db), id, 2_000_000, '2026-10-12');
    expect(before.status).toBe('ok');
    expect(after.status).toBe('ok');
    if (before.status !== 'ok' || after.status !== 'ok') return;
    expect(after.debtFree > before.debtFree).toBe(true);
    savePurchase(db, id, 2_000_000, '2026-10-12');
    const saved = purchasePreview(snap(db), id, 0, '2026-10-12');
    expect(saved.before).toMatchObject({ status: 'ok', debtFree: after.debtFree });
  });

  it('a zero preview changes nothing', () => {
    const { db, id } = setup();
    const { before, after } = purchasePreview(snap(db), id, 0, '2026-10-12');
    expect(after).toBe(before);
  });

  it('words the impact neutrally', () => {
    expect(purchaseImpact(ok('2027-06'), ok('2027-06'), null)).toEqual({ text: 'Enter the amount you spent.', tone: 'warn' });
    expect(purchaseImpact(ok('2027-06'), ok('2027-06'), 1000).text).toBe('Your plan includes it. Your debt-free date stays at June 2027.');
    expect(purchaseImpact(ok('2027-06'), ok('2027-07'), 1000).text).toBe(
      'This moves your debt-free date about 1 month later, to July 2027. An extra payment can win it back.',
    );
    expect(purchaseImpact(ok('2027-06'), ok('2027-09'), 1000).text).toMatch(/about 3 months later, to September 2027/);
    const shortfall: PlanResult = { status: 'shortfall', month: '2026-10', minimumsTotal: 2, shortBy: 1 };
    expect(purchaseImpact(ok('2027-06'), shortfall, 1000).text).toMatch(/minimums are more than your monthly budget/);
    expect(purchaseImpact(ok('2027-06'), { status: 'neverPaysOff', debtIds: [], monthsSimulated: 600 }, 1000).text).toMatch(/interest outpaces/);
  });
});
