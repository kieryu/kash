import { testDb } from '@/db/__tests__/testDb';
import { recordCheckIn } from '@/db/repositories/checkins';
import { createDebt, deleteDebt, getDebt, listDebts, updateDebt, type NewDebt } from '@/db/repositories/debts';
import { updateSettings } from '@/db/repositories/settings';
import { addTransaction, balanceOf, balances, listTransactions } from '@/db/repositories/transactions';
import { statementCheckins, type Db } from '@/db/schema';

import { debtsList, loadSnapshot, monthPlan, paidOffText, progress, type Snapshot } from '../dashboard';
import { formValuesOf, parseDebtEdit, saveDebtEdit, segmentOf } from '../debtForm';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const card: NewDebt = {
  nickname: 'Everyday Card',
  kind: 'credit_card',
  templateId: 'bdo-visa',
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
const gadget: NewDebt = {
  ...card,
  nickname: 'Phone',
  kind: 'card_installment',
  templateId: 'custom',
  monthlyRate: '0',
  minRule: null,
  minFixedMinor: null,
  amortizationMinor: 250_000,
  interestMethod: 'baked_in',
  acceptsExtra: false,
};
const TODAY = '2026-10-20';

function edit(db: Db, id: string, change: (v: ReturnType<typeof formValuesOf>) => void) {
  const row = getDebt(db, id)!;
  const bal = balanceOf(db, id);
  const orig = formValuesOf(row, bal);
  const v = { ...orig };
  change(v);
  const r = parseDebtEdit(v, orig, bal, 'PHP');
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  saveDebtEdit(db, id, r.edit, TODAY);
  return r.edit;
}

describe('edit a debt', () => {
  it('prefills the form from the stored debt', () => {
    const db = testDb();
    const id = createDebt(db, card, { balanceMinor: 821_000, on: '2026-10-01' });
    const v = formValuesOf(getDebt(db, id)!, 821_000);
    expect(v).toMatchObject({ segment: 'card', templateId: 'bdo-visa', nickname: 'Everyday Card', rate: '3%', minimum: '850', dueDay: '28' });
    expect(segmentOf(getDebt(db, createDebt(db, gadget, { balanceMinor: 1_000_000, on: '2026-10-01' }))!)).toBe('installment');
  });

  it('revolving: changes terms, never the balance or history', () => {
    const db = testDb();
    const id = createDebt(db, card, { balanceMinor: 821_000, on: '2026-10-01' });
    const before = listTransactions(db, id);
    const e = edit(db, id, (v) => {
      v.nickname = 'Main card';
      v.minimum = '3%';
      v.dueDay = '15';
    });
    expect(e.correction).toBe(0);
    const row = getDebt(db, id)!;
    expect(row).toMatchObject({ nickname: 'Main card', minRule: 'percent', minPercent: '0.03', minFixedMinor: null, dueDay: 15, acceptsExtra: true });
    expect(listTransactions(db, id)).toEqual(before);
  });

  it('keeps a minimum rule the form can’t show when the field is untouched', () => {
    const db = testDb();
    const id = createDebt(db, { ...card, minRule: 'percent_or_fixed', minPercent: '0.03', minFixedMinor: 50_000 }, { balanceMinor: 821_000, on: '2026-10-01' });
    edit(db, id, (v) => (v.nickname = 'Renamed'));
    expect(getDebt(db, id)).toMatchObject({ minRule: 'percent_or_fixed', minPercent: '0.03', minFixedMinor: 50_000 });
  });

  it('installment: new payment or months left appends a correction row', () => {
    const db = testDb();
    const id = createDebt(db, gadget, { balanceMinor: 1_000_000, on: '2026-10-01' }); // 4 × 2,500
    const e = edit(db, id, (v) => (v.payment = '2,600'));
    expect(e.correction).toBe(40_000);
    expect(getDebt(db, id)!.amortizationMinor).toBe(260_000);
    expect(balanceOf(db, id)).toBe(1_040_000);
    expect(listTransactions(db, id).map((t) => t.type)).toEqual(['correction', 'opening']);

    edit(db, id, (v) => (v.monthsLeft = '2'));
    expect(balanceOf(db, id)).toBe(520_000);
  });

  it('installment: correction to zero marks it paid off; untouched fields add nothing', () => {
    const db = testDb();
    const id = createDebt(db, gadget, { balanceMinor: 1_000_000, on: '2026-10-01' });
    expect(edit(db, id, (v) => (v.nickname = 'Phone plan')).correction).toBe(0);
    expect(listTransactions(db, id)).toHaveLength(1);
    addTransaction(db, { debtId: id, type: 'payment', amountMinor: -1_000_000, occurredOn: TODAY });
    // Paid off: months left prefills as 0 and still saves.
    expect(edit(db, id, (v) => (v.dueDay = '5')).correction).toBe(0);
  });

  it('rejects the same bad input as the add form', () => {
    const db = testDb();
    const id = createDebt(db, card, { balanceMinor: 821_000, on: '2026-10-01' });
    const orig = formValuesOf(getDebt(db, id)!, 821_000);
    const r = parseDebtEdit({ ...orig, nickname: '4111 1111 1111 1111' }, orig, 821_000, 'PHP');
    expect(r.ok).toBe(false);
  });
});

describe('archive and delete', () => {
  function setup() {
    const db = testDb();
    const a = createDebt(db, card, { balanceMinor: 821_000, on: '2026-10-01' });
    const b = createDebt(db, { ...card, nickname: 'Second', minFixedMinor: 50_000 }, { balanceMinor: 300_000, on: '2026-10-01' });
    updateSettings(db, { budgetMinor: 500_000, strategy: 'snowball' });
    return { db, a, b };
  }
  const snap = (db: Db): Snapshot => ({ ...loadSnapshot(db), month: '2026-10' });

  it('archived debts leave the plan and totals but keep history', () => {
    const { db, a, b } = setup();
    updateDebt(db, b, { archivedAt: '2026-10-20T00:00:00.000Z' });
    const s = snap(db);
    expect(monthPlan(s).lines.map((l) => l.debtId)).toEqual([a]);
    expect(progress(s.txs).remaining).toBe(821_000);
    expect(debtsList(s, TODAY).totalLeft).toBe(821_000);
    expect(listTransactions(db, b)).toHaveLength(1);
    updateDebt(db, b, { archivedAt: null });
    expect(listDebts(db)).toHaveLength(2);
  });

  it('delete removes the debt, its transactions and check-ins', () => {
    const { db, a, b } = setup();
    addTransaction(db, { debtId: b, type: 'payment', amountMinor: -10_000, occurredOn: TODAY });
    recordCheckIn(db, { debtId: b, statementDate: TODAY, statementMinor: 295_000, reason: 'interest_fees' });
    deleteDebt(db, b);
    expect(getDebt(db, b)).toBeUndefined();
    expect(listTransactions(db, b)).toHaveLength(0);
    expect(db.select().from(statementCheckins).all()).toHaveLength(0);
    expect([...balances(db).keys()]).toEqual([a]);
    expect(debtsList(snap(db), TODAY).active.map((i) => i.debt.id)).toEqual([a]);
  });
});

describe('Debts tab list', () => {
  it('focus first, paid-off apart, minimums summed', () => {
    const db = testDb();
    const big = createDebt(db, card, { balanceMinor: 821_000, on: '2026-10-01' });
    const small = createDebt(db, { ...card, nickname: 'Small', minFixedMinor: 50_000 }, { balanceMinor: 300_000, on: '2026-10-01' });
    const done = createDebt(db, { ...card, nickname: 'Done' }, { balanceMinor: 0, on: '2026-10-01' });
    updateDebt(db, done, { paidOffOn: '2026-10-05' });
    updateSettings(db, { budgetMinor: 500_000, strategy: 'snowball' });
    const l = debtsList({ ...loadSnapshot(db), month: '2026-10' }, TODAY);
    expect(l.active.map((i) => [i.debt.id, i.isFocus])).toEqual([
      [small, true],
      [big, false],
    ]);
    expect(l.active[0].payoffText).toMatch(/^Paid off (in \d+ days|around )/);
    expect(l.paidOff.map((r) => r.id)).toEqual([done]);
    expect(paidOffText(l.paidOff[0])).toMatch(/^Paid off Oct 2026$/);
    expect(l.totalLeft).toBe(1_121_000);
    expect(l.minimums).toBe(135_000);
  });
});
