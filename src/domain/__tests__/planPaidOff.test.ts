import { testDb } from '@/db/__tests__/testDb';
import { createDebt, type NewDebt } from '@/db/repositories/debts';
import { updateSettings } from '@/db/repositories/settings';

import { saveCheckIn } from '../checkin';
import { debtsList, loadSnapshot, plannedAmount, planMonths, paidOffSummary, projection, type Snapshot } from '../dashboard';
import { firstPayoff, savePayment, undoPayment } from '../payments';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const card: NewDebt = {
  nickname: 'Everyday Card',
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
};
const family: NewDebt = { ...card, nickname: 'Ate’s loan', monthlyRate: '0', minFixedMinor: 100_000, dueDay: 30 };

const MONTH = '2026-10';
const TODAY = '2026-10-20';
let clock = Date.parse('2026-10-20T01:00:00Z');

// Distinct createdAt per write, so write order is unambiguous.
beforeEach(() => jest.useFakeTimers({ now: clock, doNotFake: ['nextTick', 'setImmediate'] }));
afterEach(() => jest.useRealTimers());
const tick = () => jest.setSystemTime((clock += 1000));

function setup() {
  const db = testDb();
  const a = createDebt(db, card, { balanceMinor: 821_000, on: '2026-10-01' });
  tick();
  const b = createDebt(db, family, { balanceMinor: 2_300_000, on: '2026-10-01' });
  tick();
  updateSettings(db, { budgetMinor: 653_500, strategy: 'snowball' });
  return { db, a, b };
}
const snap = (db: ReturnType<typeof testDb>): Snapshot => ({ ...loadSnapshot(db), month: MONTH });
const pay = (db: ReturnType<typeof testDb>, id: string, amount: number) => {
  tick();
  return savePayment(db, { debtId: id, mode: 'planned' }, amount, MONTH, TODAY);
};

describe('Plan tab', () => {
  it('month table rows add up the projection and end at zero', () => {
    const { db, a, b } = setup();
    const result = projection(snap(db));
    const rows = planMonths(result);
    if (result.status !== 'ok') throw new Error('expected a plan');
    expect(rows).toHaveLength(result.months.length);
    expect(rows[0].month).toBe(MONTH);
    expect(rows[0].paid).toBe(653_500); // the whole budget goes out in month 1
    expect(rows[0].left).toBe(rows[0].lines.reduce((s, l) => s + l.closing, 0));
    expect(rows[0].paid).toBe(rows[0].lines.reduce((s, l) => s + plannedAmount(l), 0));
    expect(rows.at(-1)!.left).toBe(0);
    expect(rows.at(-1)!.month).toBe(result.debtFree);
    expect(rows.reduce((s, r) => s + r.interest, 0)).toBe(result.totals.interest);
    // Payoff order: snowball focus (smallest) first, then the rest.
    expect(debtsList(snap(db), TODAY).active.map((i) => i.debt.id)).toEqual([a, b]);
  });

  it('no month table without a debt-free date', () => {
    const { db } = setup();
    updateSettings(db, { budgetMinor: 1000 });
    expect(planMonths(projection(snap(db)))).toEqual([]);
  });
});

describe('paid-off moment', () => {
  it('shows once per debt: not again after undo + re-pay', () => {
    const { db, a } = setup();
    expect(pay(db, a, 500_000)).toBe(false);
    expect(firstPayoff(db, a)).toBe(false);
    expect(pay(db, a, 321_000)).toBe(true);
    expect(firstPayoff(db, a)).toBe(true);
    tick();
    expect(undoPayment(db, a, MONTH, TODAY)).toBe(true);
    expect(firstPayoff(db, a)).toBe(false);
    expect(pay(db, a, 821_000)).toBe(true);
    expect(firstPayoff(db, a)).toBe(false);
  });

  it('a check-in that brings the balance to zero counts', () => {
    const { db, a } = setup();
    tick();
    expect(saveCheckIn(db, a, 0, 'unlogged_payment', TODAY)).toBe(true);
    expect(firstPayoff(db, a)).toBe(true);
  });

  it('summary: extra moves to the next debt; last debt reads debt-free', () => {
    const { db, a, b } = setup();
    pay(db, a, 821_000);
    const s = paidOffSummary(snap(db), a, TODAY);
    expect(s).toMatchObject({ isLast: false, paidOnThis: 821_000, totalPaid: 821_000, debtsLeft: 1, nextName: 'Ate’s loan' });
    expect(s.debtFree).not.toBeNull();

    pay(db, b, 2_300_000);
    expect(firstPayoff(db, b)).toBe(true);
    const last = paidOffSummary(snap(db), b, TODAY);
    expect(last).toMatchObject({ isLast: true, debtsLeft: 0, nextName: null, debtFree: null, totalPaid: 3_121_000 });
  });
});
