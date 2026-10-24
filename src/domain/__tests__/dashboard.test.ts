import { testDb } from '@/db/__tests__/testDb';
import { createDebt, getDebt, type NewDebt } from '@/db/repositories/debts';
import { updateSettings } from '@/db/repositories/settings';
import { addTransaction, balanceOf, listTransactions } from '@/db/repositories/transactions';
import type { Db } from '@/db/schema';

import {
  countdown,
  dueText,
  loadSnapshot,
  monthPlan,
  moneyText,
  movement,
  movementText,
  nextDueDate,
  paidInMonth,
  plannedAmount,
  progress,
  projection,
  type Snapshot,
} from '../dashboard';
import { formatMoney } from '../format';
import { paidText, savePayment, sheetChips, sheetImpact, undoPayment, type SheetTarget } from '../payments';

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
const money = (n: number) => formatMoney(n, 'PHP', 'en-PH');

function setup() {
  const db = testDb();
  const a = createDebt(db, card, { balanceMinor: 821_000, on: '2026-10-01' });
  const b = createDebt(db, family, { balanceMinor: 2_300_000, on: '2026-10-01' });
  updateSettings(db, { budgetMinor: 653_500, strategy: 'snowball' });
  return { db, a, b };
}

function snap(db: Db): Snapshot {
  return { ...loadSnapshot(db), month: MONTH };
}

describe('this month’s plan', () => {
  it('maps engine lines: focus gets min + extra, others their minimum', () => {
    const { db, a, b } = setup();
    const p = monthPlan(snap(db));
    expect(p.shortfall).toBeNull();
    expect(p.focusId).toBe(a);
    expect(p.nextFocusId).toBe(b);
    const line = (id: string) => p.lines.find((l) => l.debtId === id)!;
    expect(plannedAmount(line(a))).toBe(553_500);
    expect(line(a).paidMinimum).toBe(85_000);
    expect(plannedAmount(line(b))).toBe(100_000);
  });

  it('does not shift as this month’s payments are logged', () => {
    const { db, a } = setup();
    const before = monthPlan(snap(db));
    savePayment(db, { debtId: a, mode: 'planned' }, 553_500, MONTH, TODAY);
    expect(monthPlan(snap(db))).toEqual(before);
  });

  it('shows minimums and the gap on a shortfall', () => {
    const { db } = setup();
    updateSettings(db, { budgetMinor: 100_000 });
    const p = monthPlan(snap(db));
    expect(p.shortfall?.shortBy).toBe(85_000);
    expect(p.focusId).toBeNull();
    expect(p.lines.map(plannedAmount)).toEqual([85_000, 100_000]);
  });
});

describe('logging and undo', () => {
  it('logs a planned payment, then undoes it with a reversal row', () => {
    const { db, a } = setup();
    savePayment(db, { debtId: a, mode: 'planned' }, 553_500, MONTH, TODAY);
    expect(balanceOf(db, a)).toBe(821_000 - 553_500);
    expect(paidInMonth(snap(db).txs, MONTH).get(a)).toEqual({ planned: 553_500, extra: 0 });

    undoPayment(db, a, MONTH, TODAY);
    expect(balanceOf(db, a)).toBe(821_000);
    expect(paidInMonth(snap(db).txs, MONTH).get(a)).toEqual({ planned: 0, extra: 0 });
    expect(listTransactions(db, a).map((t) => t.type).sort()).toEqual(['opening', 'payment', 'reversal']);
    // Nothing left to undo: a second undo writes nothing.
    undoPayment(db, a, MONTH, TODAY);
    expect(listTransactions(db, a)).toHaveLength(3);
  });

  it('keeps extra payments apart and leaves them on undo', () => {
    const { db, a } = setup();
    savePayment(db, { debtId: a, mode: 'extra' }, 100_000, MONTH, TODAY);
    undoPayment(db, a, MONTH, TODAY);
    expect(paidInMonth(snap(db).txs, MONTH).get(a)).toEqual({ planned: 0, extra: 100_000 });
  });

  it('marks a debt paid off when cleared and clears the mark on undo', () => {
    const { db, a } = setup();
    expect(savePayment(db, { debtId: a, mode: 'planned' }, 821_000, MONTH, TODAY)).toBe(true);
    expect(getDebt(db, a)?.paidOffOn).toBe(TODAY);
    expect(undoPayment(db, a, MONTH, TODAY)).toBe(true);
    expect(getDebt(db, a)?.paidOffOn).toBeNull();
  });

  it('rejects zero or fractional amounts', () => {
    const { db, a } = setup();
    expect(() => savePayment(db, { debtId: a, mode: 'planned' }, 0, MONTH, TODAY)).toThrow();
    expect(() => savePayment(db, { debtId: a, mode: 'planned' }, 1.5, MONTH, TODAY)).toThrow();
  });
});

describe('projection, progress and movement', () => {
  it('a payment as planned keeps the date; extra money moves it closer', () => {
    const { db, a } = setup();
    const base = projection(snap(db));
    savePayment(db, { debtId: a, mode: 'planned' }, 553_500, MONTH, TODAY);
    expect(projection(snap(db))).toEqual(base);
    expect(movementText(movement(snap(db)), money)).toBe('✓ Your last payment was right on plan');

    savePayment(db, { debtId: a, mode: 'extra' }, 1_000_000, MONTH, TODAY);
    const m = movement(snap(db))!;
    expect(m.months).toBeGreaterThan(0);
    expect(movementText(m, money)).toMatch(/^↑ Your last payment moved you \d+ months? closer$/);
  });

  it('a new charge pushes the date back, phrased neutrally', () => {
    const { db, b } = setup();
    addTransaction(db, { debtId: b, type: 'charge', amountMinor: 1_000_000, occurredOn: TODAY });
    expect(movementText(movement(snap(db)), money)).toMatch(/later\. An extra payment can win it back\.$/);
  });

  it('no movement before anything is logged', () => {
    expect(movement(snap(setup().db))).toBeNull();
  });

  it('% paid off = paid ÷ (paid + remaining)', () => {
    const { db, a } = setup();
    savePayment(db, { debtId: a, mode: 'planned' }, 312_000, MONTH, TODAY);
    const p = progress(snap(db).txs);
    expect(p.paid).toBe(312_000);
    expect(p.remaining).toBe(821_000 + 2_300_000 - 312_000);
    expect(p.ratio).toBeCloseTo(0.1);
    undoPayment(db, a, MONTH, TODAY);
    expect(progress(snap(db).txs).paid).toBe(0);
  });
});

describe('countdown (§17)', () => {
  it('shows month and year when far away', () => {
    expect(countdown('2026-10-20', '2027-12-28')).toMatchObject({ big: 'December 2027', sub: 'in about 1 year 2 months', inDays: false });
  });

  it('switches to days at 90 days or less', () => {
    expect(countdown('2026-10-20', '2027-01-18')).toMatchObject({ big: '90 days', sub: 'around Jan 18', inDays: true });
    expect(countdown('2026-10-20', '2027-01-19').inDays).toBe(false);
    expect(countdown('2026-10-20', '2026-10-21').big).toBe('1 day');
    expect(countdown('2026-10-20', '2026-10-20').big).toBe('This month');
  });

  it('due dates roll to next month once passed and clamp to month end', () => {
    expect(nextDueDate(28, '2026-10-20')).toBe('2026-10-28');
    expect(nextDueDate(3, '2026-10-20')).toBe('2026-11-03');
    expect(nextDueDate(31, '2026-11-05')).toBe('2026-11-30');
    expect(nextDueDate(30, '2027-01-31')).toBe('2027-02-28');
    expect(nextDueDate(null, '2026-10-20')).toBeNull();
    expect(dueText('2026-10-28', '2026-10-20', true)).toBe('Due Oct 28 · in 8 days');
    expect(dueText('2026-10-20', '2026-10-20', true)).toBe('Due today');
  });
});

describe('hide balances', () => {
  it('masks amounts but keeps the currency symbol', () => {
    expect(moneyText(821_000, 'PHP', false, 'en-PH')).toBe('₱8,210');
    expect(moneyText(821_000, 'PHP', true, 'en-PH')).toBe('₱ • • • •');
    expect(moneyText(821_000, 'PHP', true, 'en-PH')).not.toMatch(/\d/);
  });
});

describe('payment sheet', () => {
  const t: SheetTarget = {
    debtId: 'a',
    name: 'Everyday Card',
    currency: 'PHP',
    mode: 'planned',
    planned: 553_500,
    minimum: 85_000,
    balance: 821_000,
    hint: '',
    nextName: 'Ate’s loan',
  };

  it('offers planned, +500, +1,000 and pay in full', () => {
    expect(sheetChips(t, money)).toEqual([
      { label: 'Planned ₱5,535', amount: 553_500 },
      { label: '+₱500', amount: 603_500 },
      { label: '+₱1,000', amount: 653_500 },
      { label: 'Pay in full', amount: 821_000 },
    ]);
  });

  it('explains the impact of each amount', () => {
    expect(sheetImpact(t, null, money).tone).toBe('warn');
    expect(sheetImpact(t, 553_500, money)).toEqual({ text: 'Right on plan. Nice.', tone: 'good' });
    expect(sheetImpact(t, 603_500, money).text).toBe('₱500 more than planned. It all goes to your balance.');
    expect(sheetImpact(t, 500_000, money)).toMatchObject({ tone: 'warn', text: '₱535 less than planned. Your plan will adjust next month.' });
    expect(sheetImpact(t, 50_000, money)).toMatchObject({ tone: 'warn' });
    expect(sheetImpact(t, 50_000, money).text).toMatch(/below the ₱850 minimum/);
    expect(sheetImpact(t, 821_000, money).text).toBe('This clears Everyday Card! Your extra money moves to Ate’s loan next.');
  });

  it('summarises what was paid against the plan', () => {
    expect(paidText(553_500, 553_500, money)).toBe('Paid ₱5,535 · as planned');
    expect(paidText(600_000, 553_500, money)).toBe('Paid ₱6,000 · ₱465 extra');
    expect(paidText(550_000, 553_500, money)).toBe('Paid ₱5,500 · ₱35 short');
  });
});
