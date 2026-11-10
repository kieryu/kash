import { createDebt, listDebts, updateDebt, type NewDebt } from '@/db/repositories/debts';
import { addTransaction, balanceOf, listTransactions } from '@/db/repositories/transactions';
import type { Db, DebtRow, TransactionRow } from '@/db/schema';
import type { Currency, Minor, YearMonth } from '@/engine/types';

import { looksLikeCardNumber } from './cardNumber';
import { parseMoney } from './format';
import { syncPaidOff } from './payments';

// R20 / D44: installments running on a credit card ("INST 03/10 ₱2,000" on the statement).
// Each one is a child debt of the card: baked-in, no extra money, its own balance = what's left to pay.
// The card's own balance is the revolving part. The statement total = revolving + this month's installments.
// The app never shows the unbilled remainder on its own; it only says "3 of 10".

export type InstallmentInput = {
  /** Stored child id when editing; undefined for a new one. */
  id?: string;
  name: string;
  amount: string;
  /** The "3" in "3 of 10". 0 = new, not on a statement yet. */
  billed: string;
  /** The "10" in "3 of 10". */
  total: string;
};

export type ParsedInstallment = { id?: string; name: string; amountMinor: Minor; billed: number; total: number };
export type InstallmentErrors = Partial<Record<'name' | 'amount' | 'billed' | 'total', string>>;

export const EMPTY_INSTALLMENT: InstallmentInput = { name: '', amount: '', billed: '', total: '' };

const int = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(/\D/g, '')));

export function parseInstallments(
  list: InstallmentInput[],
  currency: Currency,
): { ok: true; items: ParsedInstallment[] } | { ok: false; errors: InstallmentErrors[] } {
  const errors: InstallmentErrors[] = [];
  const items: ParsedInstallment[] = [];
  for (const i of list) {
    const e: InstallmentErrors = {};
    const name = i.name.trim();
    if (looksLikeCardNumber(name)) e.name = 'This looks like a card number. Use a name like “Phone” instead.';
    const amountMinor = parseMoney(i.amount, currency);
    if (!amountMinor) e.amount = 'Enter the monthly amount.';
    const total = int(i.total);
    const billed = int(i.billed);
    if (!(Number.isInteger(total) && total >= 1 && total <= 600)) e.total = 'Enter the total, e.g. 10.';
    else if (!(Number.isInteger(billed) && billed >= 0 && billed <= total)) e.billed = `Enter 0 to ${total}.`;
    errors.push(e);
    if (Object.keys(e).length === 0) items.push({ id: i.id, name, amountMinor: amountMinor!, billed, total });
  }
  return errors.some((e) => Object.keys(e).length) ? { ok: false, errors } : { ok: true, items };
}

/** On this statement = the statement total already includes this month's installment. */
export function onStatement(i: Pick<ParsedInstallment, 'billed'>): boolean {
  return i.billed >= 1;
}

/** What's left to pay, counting this statement's payment: "3 of 10" → 8 payments; "0 of 10" → 10. */
export function installmentLeft(i: Pick<ParsedInstallment, 'amountMinor' | 'billed' | 'total'>): Minor {
  return i.amountMinor * (i.total - Math.max(1, i.billed) + 1);
}

/** Card's own (revolving) balance = statement total − installments on this statement. */
export function revolvingFromStatement(statementTotal: Minor, items: ParsedInstallment[]): Minor {
  return statementTotal - items.filter(onStatement).reduce((s, i) => s + i.amountMinor, 0);
}

/** The child debt row: follows the card's look, currency and due day (for payoff dates); no reminders of its own. */
export function childDebt(card: Pick<NewDebt, 'color' | 'currency' | 'dueDay' | 'issuer' | 'templateId'>, parentId: string, i: ParsedInstallment): NewDebt {
  return {
    nickname: i.name || 'Installment',
    kind: 'card_installment',
    issuer: card.issuer,
    templateId: card.templateId,
    color: card.color,
    currency: card.currency,
    monthlyRate: '0',
    rateEnteredAs: 'monthly',
    amortizationMinor: i.amountMinor,
    interestMethod: 'baked_in',
    acceptsExtra: false,
    dueDay: card.dueDay,
    statementDay: null,
    autoDeducted: false,
    parentDebtId: parentId,
    installmentTotal: i.total,
  };
}

/** New card + its installments in one DB transaction. Card opening = statement total − billed installments. */
export function createCardWithInstallments(db: Db, card: NewDebt, statementTotal: Minor, items: ParsedInstallment[], on: string): string {
  return db.transaction((tx) => {
    const id = createDebt(tx, card, { balanceMinor: revolvingFromStatement(statementTotal, items), on });
    for (const i of items) createDebt(tx, childDebt(card, id, i), { balanceMinor: installmentLeft(i), on });
    return id;
  });
}

// --- Reading families from stored rows ---

export function isChild(r: Pick<DebtRow, 'parentDebtId'>): boolean {
  return r.parentDebtId != null;
}

/** Debts as the user sees them: cards and other debts, without the installments on cards. */
export function topLevel<T extends Pick<DebtRow, 'parentDebtId'>>(rows: T[]): T[] {
  return rows.filter((r) => !isChild(r));
}

export function childrenOf<T extends Pick<DebtRow, 'parentDebtId'>>(rows: T[], parentId: string): T[] {
  return rows.filter((r) => r.parentDebtId === parentId);
}

/** "Phone · Everyday Card" for an installment on a card, else the debt's nickname. */
export function displayName(rows: Pick<DebtRow, 'id' | 'nickname' | 'parentDebtId'>[], id: string): string {
  const r = rows.find((x) => x.id === id);
  if (!r) return '';
  const parent = r.parentDebtId ? rows.find((x) => x.id === r.parentDebtId) : undefined;
  return parent ? `${r.nickname} · ${parent.nickname}` : r.nickname;
}

/** The id the user sees for a debt: the card for an installment on it, else itself. */
export function ownerId(rows: Pick<DebtRow, 'id' | 'parentDebtId'>[], id: string): string {
  return rows.find((r) => r.id === id)?.parentDebtId ?? id;
}

type MonthTxs = { txs: TransactionRow[]; month: YearMonth };

function balanceAt(txs: TransactionRow[], debtId: string, keep: (t: TransactionRow) => boolean): Minor {
  return txs.reduce((s, t) => (t.debtId === debtId && keep(t) ? s + t.amountMinor : s), 0);
}

/** Planned money logged on `debtId` this month (payments net of undos). */
function paidThisMonth({ txs, month }: MonthTxs, debtId: string): Minor {
  return -balanceAt(txs, debtId, (t) => t.planMonth === month && !t.isExtra);
}

/** This month's installment: its amount, or what's left if less. 0 once fully paid. */
export function billedThisMonth(child: Pick<DebtRow, 'id' | 'amortizationMinor'>, m: MonthTxs): Minor {
  const start = Math.max(0, balanceAt(m.txs, child.id, (t) => t.planMonth !== m.month));
  return Math.min(child.amortizationMinor ?? 0, start);
}

/** This month's installment not yet paid. */
export function billedUnpaid(child: Pick<DebtRow, 'id' | 'amortizationMinor'>, m: MonthTxs): Minor {
  return Math.max(0, billedThisMonth(child, m) - paidThisMonth(m, child.id));
}

/** "3 of 10": this month's payment number, from the balance at the start of the month. */
export function installmentNumber(child: Pick<DebtRow, 'id' | 'amortizationMinor' | 'installmentTotal'>, m: MonthTxs): { n: number; total: number; done: boolean } {
  const total = child.installmentTotal ?? 0;
  const amount = child.amortizationMinor ?? 0;
  const start = Math.max(0, balanceAt(m.txs, child.id, (t) => t.planMonth !== m.month));
  const left = amount > 0 ? Math.ceil(start / amount) : 0;
  return { n: Math.min(total, Math.max(1, total - left + 1)), total, done: left === 0 };
}

/** What the card shows, like the bank's outstanding balance: its own balance + this month's unpaid installments. */
export function cardBalance(rows: Pick<DebtRow, 'id' | 'parentDebtId' | 'amortizationMinor'>[], m: MonthTxs, cardId: string): Minor {
  const own = Math.max(0, balanceAt(m.txs, cardId, () => true));
  return own + childrenOf(rows, cardId).reduce((s, c) => s + billedUnpaid(c, m), 0);
}

/** Splits a payment to a card: this month's installments first, then the card's own balance (D44). */
export function allocatePayment(
  rows: Pick<DebtRow, 'id' | 'parentDebtId' | 'amortizationMinor'>[],
  m: MonthTxs,
  cardId: string,
  amount: Minor,
): { debtId: string; amount: Minor }[] {
  const out: { debtId: string; amount: Minor }[] = [];
  let left = amount;
  for (const c of childrenOf(rows, cardId)) {
    const take = Math.min(left, billedUnpaid(c, m));
    if (take > 0) out.push({ debtId: c.id, amount: take });
    left -= take;
  }
  if (left > 0) out.push({ debtId: cardId, amount: left });
  return out;
}

/** Archive or restore a debt together with its installments. */
export function setFamilyArchived(db: Db, id: string, archivedAt: string | null): void {
  db.transaction((tx) => {
    for (const r of [id, ...childrenOf(listDebts(tx, { includeArchived: true }), id).map((k) => k.id)]) updateDebt(tx, r, { archivedAt });
  });
}

/** Edit: a correction row so a child's balance matches the new "X of Y" and amount. */
export function installmentCorrection(db: Db, childId: string, current: Minor, target: Minor, on: string): void {
  if (target !== current) addTransaction(db, { debtId: childId, type: 'correction', amountMinor: target - current, occurredOn: on });
}

/**
 * Edit debt (card): applies the installment list. Removed ones are archived (history kept). New ones start
 * at "X of Y"; one already on the statement comes out of the card's balance, since the statement total held it.
 * Changed ones get a correction row so the balance matches the new "X of Y" and amount. Children follow the
 * card's color, issuer and due day.
 */
export function saveInstallments(
  db: Db,
  cardId: string,
  before: ParsedInstallment[],
  after: ParsedInstallment[],
  month: YearMonth,
  on: string,
): void {
  db.transaction((tx) => {
    const card = listDebts(tx).find((r) => r.id === cardId);
    if (!card) return;
    const keep = new Set(after.map((i) => i.id).filter(Boolean));
    for (const b of before) if (b.id && !keep.has(b.id)) updateDebt(tx, b.id, { archivedAt: new Date().toISOString() });
    for (const i of after) {
      if (!i.id) {
        createDebt(tx, childDebt(card, cardId, i), { balanceMinor: installmentLeft(i), on });
        const take = onStatement(i) ? Math.min(i.amountMinor, Math.max(0, balanceOf(tx, cardId))) : 0;
        if (take > 0) addTransaction(tx, { debtId: cardId, type: 'correction', amountMinor: -take, occurredOn: on, note: 'Installment moved out of the card balance' });
        continue;
      }
      const old = before.find((b) => b.id === i.id);
      updateDebt(tx, i.id, { nickname: i.name || 'Installment', color: card.color, issuer: card.issuer, templateId: card.templateId, dueDay: card.dueDay });
      if (old && old.amountMinor === i.amountMinor && old.billed === i.billed && old.total === i.total) continue;
      updateDebt(tx, i.id, { amortizationMinor: i.amountMinor, installmentTotal: i.total });
      const paid = paidThisMonth({ txs: listTransactions(tx, i.id), month }, i.id);
      installmentCorrection(tx, i.id, balanceOf(tx, i.id), Math.max(0, installmentLeft(i) - paid), on);
    }
    syncPaidOff(tx, cardId, on);
  });
}
