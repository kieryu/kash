import { testDb } from '@/db/__tests__/testDb';
import { createDebt, getDebt, type NewDebt } from '@/db/repositories/debts';
import { updateSettings } from '@/db/repositories/settings';
import { balanceOf, listTransactions } from '@/db/repositories/transactions';
import { statementCheckins, type Db } from '@/db/schema';
import { simulate } from '@/engine/simulate';

import { checkInImpact, impactText, reasonsFor, saveCheckIn, statementDate } from '../checkin';
import { outcome, tradeOff } from '../compare';
import { loadSnapshot, monthPlan, projection, type Snapshot } from '../dashboard';
import { toEngineDebts } from '../engineDebts';
import { explainRows } from '../explain';
import { formatMoney } from '../format';

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
const family: NewDebt = { ...card, nickname: 'Ate’s loan', monthlyRate: '0', minFixedMinor: 100_000, statementDay: null };
const money = (n: number) => formatMoney(n, 'PHP', 'en-PH');
const snap = (db: Db): Snapshot => ({ ...loadSnapshot(db), month: '2026-10' });

function setup() {
  const db = testDb();
  const a = createDebt(db, card, { balanceMinor: 2_300_000, on: '2026-10-01' });
  const b = createDebt(db, family, { balanceMinor: 821_000, on: '2026-10-01' });
  updateSettings(db, { budgetMinor: 653_500, strategy: 'snowball' });
  return { db, a, b };
}

describe('statement check-in', () => {
  it('offers reasons that fit the difference (D8)', () => {
    expect(reasonsFor(126_900)).toEqual(['interest_fees', 'new_charges']);
    expect(reasonsFor(-5_000)).toEqual(['unlogged_payment']);
    expect(reasonsFor(0)).toEqual([]);
  });

  it('dates the statement on the latest statement day', () => {
    expect(statementDate(3, '2026-11-05')).toBe('2026-11-03');
    expect(statementDate(25, '2026-11-05')).toBe('2026-10-25');
    expect(statementDate(31, '2026-03-02')).toBe('2026-02-28');
    expect(statementDate(null, '2026-11-05')).toBe('2026-11-05');
  });

  it('saves the difference as one transaction plus a check-in row', () => {
    const { db, a } = setup();
    expect(saveCheckIn(db, a, 2_426_900, 'new_charges', '2026-11-03')).toBe(false);
    expect(listTransactions(db, a)[0]).toMatchObject({ type: 'charge', amountMinor: 126_900, occurredOn: '2026-11-03' });
    expect(balanceOf(db, a)).toBe(2_426_900);
    expect(db.select().from(statementCheckins).all()).toEqual([
      expect.objectContaining({ debtId: a, expectedMinor: 2_300_000, statementMinor: 2_426_900, reason: 'new_charges' }),
    ]);
  });

  it('marks the debt paid off when an unlogged payment clears it', () => {
    const { db, b } = setup();
    expect(saveCheckIn(db, b, 0, 'unlogged_payment', '2026-11-03')).toBe(true);
    expect(listTransactions(db, b)[0]).toMatchObject({ type: 'payment', amountMinor: -821_000 });
    expect(getDebt(db, b)?.paidOffOn).toBe('2026-11-03');
  });

  it('a matching statement writes no transaction', () => {
    const { db, a } = setup();
    saveCheckIn(db, a, 2_300_000, null, '2026-11-03');
    expect(listTransactions(db, a)).toHaveLength(1);
    expect(db.select().from(statementCheckins).all()).toHaveLength(1);
  });

  it('previews the impact on the debt-free date before saving', () => {
    const { db, a } = setup();
    const s = snap(db);
    const same = checkInImpact(s, a, 2_300_000, null, '2026-11-03');
    expect(impactText(same.before, same.after, null)).toMatch(/^Your debt-free date stays at /);

    const more = checkInImpact(s, a, 3_300_000, 'new_charges', '2026-11-03');
    expect(more.before.status === 'ok' && more.after.status === 'ok' && more.after.debtFree > more.before.debtFree).toBe(true);
    expect(impactText(more.before, more.after, 'new_charges')).toMatch(/moves from .* to .*Pausing purchases/);

    // Preview matches what saving produces.
    saveCheckIn(db, a, 3_300_000, 'new_charges', '2026-11-03');
    expect(projection(snap(db))).toEqual(more.after);
  });
});

describe('compare strategies', () => {
  it('avalanche costs less interest, snowball clears a debt sooner', () => {
    const { db } = setup();
    const snow = outcome(snap(db), 'snowball')!;
    const aval = outcome(snap(db), 'avalanche')!;
    expect(aval.interest).toBeLessThan(snow.interest);
    expect(snow.firstGone < aval.firstGone).toBe(true);
    expect(tradeOff(snow, aval, money)).toMatch(/^Avalanche saves about ₱[\d,]+.*Snowball clears your first debt \d+ months? sooner\.$/);
  });

  it('matches a direct engine run and ignores the saved strategy', () => {
    const { db } = setup();
    updateSettings(db, { strategy: 'avalanche' });
    const r = simulate({ ...rawInput(db), strategy: { kind: 'snowball' } });
    expect(r.status === 'ok' && outcome(snap(db), 'snowball')?.interest).toBe(r.status === 'ok' && r.totals.interest);
  });

  it('describes the trade-off plainly', () => {
    const o = (debtFree: string, interest: number, firstGone: string) => ({ debtFree, interest, firstGone });
    expect(tradeOff(o('2027-12', 1_482_000, '2026-12'), o('2027-11', 1_396_000, '2027-03'), money)).toBe(
      'Avalanche saves about ₱860 and 1 month. Snowball clears your first debt 3 months sooner.',
    );
    expect(tradeOff(o('2027-12', 100, '2027-01'), o('2027-12', 100, '2027-01'), money)).toMatch(/about the same/);
    expect(tradeOff(null, o('2027-12', 100, '2027-01'), money)).toMatch(/Raise your monthly budget/);
  });
});

describe('how was this calculated', () => {
  it('shows each step with its inputs', () => {
    const { db, a } = setup();
    const s = snap(db);
    const line = monthPlan(s).lines.find((l) => l.debtId === a)!;
    const debt = toEngineDebts(s.rows, new Map()).find((d) => d.id === a)!;
    const rows = explainRows(debt, line, 'en-PH');
    expect(rows.map((r) => r.label)).toEqual([
      'Balance at the start of the month',
      'Minimum due',
      'Planned payment',
      'Interest',
      'Balance after this month',
    ]);
    // ₱23,000 − ₱850 min = ₱22,150 × 3% = ₱664.50.
    expect(rows[3]).toEqual({ label: 'Interest', formula: '(₱23,000 − ₱850) × 3% a month = ₱664.5, rounded half-up', result: '₱664.50' });
    expect(rows[4].result).toBe(money(line.closing));
  });
});

function rawInput(db: Db) {
  const s = snap(db);
  return {
    debts: toEngineDebts(s.rows, new Map(s.rows.map((r) => [r.id, balanceOf(db, r.id)]))),
    budget: 653_500,
    currency: 'PHP',
    strategy: { kind: 'snowball' as const },
    start: '2026-10',
  };
}
