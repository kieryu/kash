import { UPGRADES, type BackupData } from '@/backup/backup';
import { testDb } from '@/db/__tests__/testDb';
import { createDebt, getDebt, listDebts, type NewDebt } from '@/db/repositories/debts';
import { updateSettings } from '@/db/repositories/settings';
import { balanceOf, listTransactions } from '@/db/repositories/transactions';
import type { Db } from '@/db/schema';
import { planReminders } from '@/notifications/reminders';

import { loadSnapshot, monthItems, monthPlan, shownBalance, debtsList, type Snapshot } from '../dashboard';
import { installmentInputsOf } from '../debtForm';
import {
  allocatePayment,
  cardBalance,
  childrenOf,
  createCardWithInstallments,
  installmentLeft,
  installmentNumber,
  parseInstallments,
  revolvingFromStatement,
  saveInstallments,
  setFamilyArchived,
  type ParsedInstallment,
} from '../installments';
import { savePayment, undoPayment } from '../payments';
import { debtCount, readOnlyIds } from '../plan';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));
jest.mock('expo-notifications', () => ({ SchedulableTriggerInputTypes: { DATE: 'date' }, AndroidImportance: { DEFAULT: 3 } }));

const MONTH = '2026-11';
const ON = '2026-11-10';

const card: NewDebt = {
  nickname: 'BDO Visa',
  kind: 'credit_card',
  issuer: 'BDO',
  color: '#1C3D73',
  currency: 'PHP',
  monthlyRate: '0.03',
  rateEnteredAs: 'monthly',
  minRule: 'fixed',
  minFixedMinor: 50_000,
  acceptsExtra: true,
  autoDeducted: false,
  dueDay: 28,
  statementDay: 3,
};
const loan: NewDebt = { ...card, nickname: 'Other card', issuer: 'BPI', statementDay: null };
// The user's example: statement ₱10,000 including "INST 03/10 ₱2,000".
const phone: ParsedInstallment = { name: 'Phone', amountMinor: 200_000, billed: 3, total: 10 };

const snap = (db: Db): Snapshot => ({ ...loadSnapshot(db), month: MONTH });

function setup(items: ParsedInstallment[] = [phone]) {
  const db = testDb();
  const id = createCardWithInstallments(db, card, 1_000_000, items, '2026-11-03');
  updateSettings(db, { budgetMinor: 1_000_000, strategy: 'snowball' });
  const kids = childrenOf(listDebts(db), id);
  return { db, id, kids };
}

describe('installments on a card (R20)', () => {
  it('reads "Your statement shows X of Y"', () => {
    expect(parseInstallments([{ name: ' Phone ', amount: '2,000', billed: '3', total: '10' }], 'PHP')).toEqual({
      ok: true,
      items: [{ id: undefined, name: 'Phone', amountMinor: 200_000, billed: 3, total: 10 }],
    });
    const bad = parseInstallments(
      [
        { name: '', amount: '', billed: '3', total: '10' },
        { name: '', amount: '100', billed: '11', total: '10' },
        { name: '4111 1111 1111 1111', amount: '100', billed: '1', total: '' },
      ],
      'PHP',
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors[0]).toEqual({ amount: 'Enter the monthly amount.' });
    expect(bad.errors[1]).toEqual({ billed: 'Enter 0 to 10.' });
    expect(bad.errors[2]).toMatchObject({ name: expect.stringMatching(/card number/), total: expect.any(String) });
  });

  it('counts what is left, this statement included; 0 = not billed yet', () => {
    expect(installmentLeft(phone)).toBe(1_600_000); // payments 3..10
    expect(installmentLeft({ ...phone, billed: 10 })).toBe(200_000);
    expect(installmentLeft({ ...phone, billed: 0 })).toBe(2_000_000);
    expect(installmentLeft({ ...phone, billed: 1 })).toBe(2_000_000);
    expect(revolvingFromStatement(1_000_000, [phone, { ...phone, billed: 0 }])).toBe(800_000);
  });

  it('splits the statement total into the card and its installment', () => {
    const { db, id, kids } = setup();
    expect(balanceOf(db, id)).toBe(800_000);
    expect(kids).toHaveLength(1);
    expect(kids[0]).toMatchObject({ kind: 'card_installment', parentDebtId: id, installmentTotal: 10, amortizationMinor: 200_000, acceptsExtra: false, nickname: 'Phone', dueDay: 28 });
    expect(balanceOf(db, kids[0].id)).toBe(1_600_000);
    const s = snap(db);
    // The card shows what the statement shows; never the unbilled rest.
    expect(cardBalance(s.rows, s, id)).toBe(1_000_000);
    expect(shownBalance(s, id)).toBe(1_000_000);
    expect(installmentNumber(kids[0], s)).toEqual({ n: 3, total: 10, done: false });
  });

  it('a new installment not on a statement yet leaves the card balance alone', () => {
    const { db, id, kids } = setup([{ ...phone, billed: 0, total: 6 }]);
    expect(balanceOf(db, id)).toBe(1_000_000);
    expect(balanceOf(db, kids[0].id)).toBe(1_200_000);
  });

  it('a payment to the card covers this month’s installment first', () => {
    const { db, id, kids } = setup();
    const s = snap(db);
    expect(allocatePayment(s.rows, s, id, 150_000)).toEqual([{ debtId: kids[0].id, amount: 150_000 }]);
    expect(allocatePayment(s.rows, s, id, 500_000)).toEqual([
      { debtId: kids[0].id, amount: 200_000 },
      { debtId: id, amount: 300_000 },
    ]);
    savePayment(db, { debtId: id, mode: 'planned' }, 500_000, MONTH, ON);
    expect(balanceOf(db, kids[0].id)).toBe(1_400_000);
    expect(balanceOf(db, id)).toBe(500_000);
    const after = snap(db);
    expect(shownBalance(after, id)).toBe(500_000);
    // Still "3 of 10" until next month; this month's is paid, so a second payment goes to the card.
    expect(installmentNumber(kids[0], after)).toEqual({ n: 3, total: 10, done: false });
    expect(allocatePayment(after.rows, after, id, 100_000)).toEqual([{ debtId: id, amount: 100_000 }]);
    // Next month it reads "4 of 10".
    expect(installmentNumber(kids[0], { ...after, month: '2026-12' }).n).toBe(4);
  });

  it('undo reverses both parts of a split payment', () => {
    const { db, id, kids } = setup();
    savePayment(db, { debtId: id, mode: 'planned' }, 500_000, MONTH, ON);
    undoPayment(db, id, MONTH, ON);
    expect(balanceOf(db, id)).toBe(800_000);
    expect(balanceOf(db, kids[0].id)).toBe(1_600_000);
  });

  it('extra money goes to the card itself, never the installment', () => {
    const { db, id, kids } = setup();
    savePayment(db, { debtId: id, mode: 'extra' }, 300_000, MONTH, ON);
    expect(balanceOf(db, id)).toBe(500_000);
    expect(balanceOf(db, kids[0].id)).toBe(1_600_000);
  });

  it('the card is paid off only when its installments are', () => {
    const { db, id, kids } = setup([{ ...phone, billed: 10 }]);
    expect(savePayment(db, { debtId: id, mode: 'extra' }, 800_000, MONTH, ON)).toBe(false);
    expect(getDebt(db, id)!.paidOffOn).toBeNull();
    expect(savePayment(db, { debtId: id, mode: 'planned' }, 200_000, MONTH, ON)).toBe(true);
    expect(getDebt(db, id)!.paidOffOn).toBe(ON);
    expect(getDebt(db, kids[0].id)!.paidOffOn).toBe(ON);
  });

  it('strategies rank the card by its own balance (statement total − installments)', () => {
    const { db, id } = setup();
    const other = createDebt(db, loan, { balanceMinor: 900_000, on: '2026-11-01' });
    // Snowball: card ₱8,000 < other ₱9,000, though the statement says ₱10,000.
    const s = snap(db);
    const plan = monthPlan(s);
    expect(plan.focusId).toBe(id);
    // This month: one item per card, the installment folded in.
    const items = monthItems(s, plan);
    expect(items.map((i) => i.debt.id)).toEqual(expect.arrayContaining([id, other]));
    expect(items).toHaveLength(2);
    const cardItem = items.find((i) => i.debt.id === id)!;
    expect(cardItem.line.minimumDue).toBe(50_000 + 200_000);
    // Lists show cards, not installments; the total left is everything owed.
    const list = debtsList(s, ON);
    expect(list.active.map((a) => a.debt.id).sort()).toEqual([id, other].sort());
    expect(list.active.find((a) => a.debt.id === id)!.balance).toBe(1_000_000);
    expect(list.totalLeft).toBe(800_000 + 1_600_000 + 900_000);
  });

  it('installments don’t count toward the free limit and follow their card’s read-only state', () => {
    const { db, id, kids } = setup([phone, { ...phone, name: 'Laptop' }]);
    createDebt(db, loan, { balanceMinor: 100_000, on: '2026-11-01' });
    createDebt(db, { ...loan, nickname: 'Third' }, { balanceMinor: 100_000, on: '2026-11-01' });
    expect(debtCount(listDebts(db))).toBe(3);
    const fourth = createDebt(db, { ...loan, nickname: 'Fourth' }, { balanceMinor: 100_000, on: '2026-11-01' });
    expect([...readOnlyIds(listDebts(db), false)]).toEqual([fourth]);
    // A card past the limit takes its installments with it.
    const late = createCardWithInstallments(db, card, 500_000, [phone], ON);
    const ro = readOnlyIds(listDebts(db), false);
    expect(ro.has(late)).toBe(true);
    expect(childrenOf(listDebts(db), late).every((k) => ro.has(k.id))).toBe(true);
    expect(kids.some((k) => ro.has(k.id) || ro.has(id))).toBe(false);
  });

  it('only the card gets reminders', () => {
    const { db, id } = setup();
    const ids = new Set(planReminders(listDebts(db), 3, new Date(2026, 10, 10)).map((r) => r.debtId));
    expect([...ids]).toEqual([id]);
  });

  it('archives and restores a card with its installments', () => {
    const { db, id, kids } = setup();
    setFamilyArchived(db, id, '2026-11-10T00:00:00.000Z');
    expect(listDebts(db)).toHaveLength(0);
    setFamilyArchived(db, id, null);
    expect(listDebts(db).map((r) => r.id).sort()).toEqual([id, kids[0].id].sort());
  });

  describe('editing', () => {
    const edit = (db: Db, id: string) => {
      const kids = childrenOf(listDebts(db), id);
      const inputs = installmentInputsOf(kids, kids.flatMap((k) => listTransactions(db, k.id)), MONTH);
      const before = parseInstallments(inputs, 'PHP');
      if (!before.ok) throw new Error('bad prefill');
      return { inputs, before: before.items };
    };

    it('prefills "X of Y" from the balance', () => {
      const { db, id, kids } = setup();
      expect(edit(db, id).inputs).toEqual([{ id: kids[0].id, name: 'Phone', amount: '2,000', billed: '3', total: '10' }]);
    });

    it('unchanged saves change nothing', () => {
      const { db, id, kids } = setup();
      const { before } = edit(db, id);
      saveInstallments(db, id, before, before, MONTH, ON);
      expect(balanceOf(db, kids[0].id)).toBe(1_600_000);
      expect(listTransactions(db, kids[0].id)).toHaveLength(1);
    });

    it('a new "X of Y" corrects the balance, minus what was paid this month', () => {
      const { db, id, kids } = setup();
      savePayment(db, { debtId: id, mode: 'planned' }, 200_000, MONTH, ON);
      const { before } = edit(db, id);
      saveInstallments(db, id, before, [{ ...before[0], billed: 5 }], MONTH, ON);
      // "5 of 10" = 6 payments from this month on; this month's ₱2,000 is already paid.
      expect(balanceOf(db, kids[0].id)).toBe(1_000_000);
    });

    it('adds one already on the statement (out of the card balance) and removes one (archived)', () => {
      const { db, id, kids } = setup();
      const { before } = edit(db, id);
      saveInstallments(db, id, before, [{ name: 'Laptop', amountMinor: 300_000, billed: 1, total: 12 }], MONTH, ON);
      expect(getDebt(db, kids[0].id)!.archivedAt).not.toBeNull();
      const now = childrenOf(listDebts(db), id);
      expect(now).toHaveLength(1);
      expect(now[0]).toMatchObject({ nickname: 'Laptop', installmentTotal: 12 });
      expect(balanceOf(db, now[0].id)).toBe(3_600_000);
      expect(balanceOf(db, id)).toBe(500_000);
    });
  });

  it('backups from before R20 import with no installments', () => {
    const v2 = { schemaVersion: 2, debts: [{ id: 'a' }], transactions: [], statementCheckins: [], settings: {} } as unknown as BackupData;
    expect(UPGRADES[1](v2).debts[0]).toMatchObject({ id: 'a', parentDebtId: null, installmentTotal: null });
  });
});
