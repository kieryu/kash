import { getDebt, updateDebt } from '@/db/repositories/debts';
import { addTransaction, balanceOf, listTransactions, reverseTransaction } from '@/db/repositories/transactions';
import type { Db, TransactionRow } from '@/db/schema';
import type { Minor, YearMonth } from '@/engine/types';

import { minorDigits } from './format';

// Log Payment sheet: what it says, and the writes behind Save and Undo.

export type SheetTarget = {
  debtId: string;
  name: string;
  currency: string;
  /** planned = this month's payment on one debt · extra = windfall to the focus debt. */
  mode: 'planned' | 'extra';
  /** This month's planned amount (0 in extra mode). */
  planned: Minor;
  minimum: Minor;
  /** Current balance. */
  balance: Minor;
  /** Hint under the title, already formatted. */
  hint: string;
  /** Next focus debt once this one is cleared. */
  nextName?: string | null;
};

export function sheetTitle(t: SheetTarget): string {
  return t.mode === 'extra' ? 'Extra payment' : `Log payment · ${t.name}`;
}

/** Quick amounts. Steps are whole currency units (₱500 / ₱1,000 for PHP). */
export function sheetChips(t: SheetTarget, money: (n: Minor) => string): { label: string; amount: Minor }[] {
  const unit = 10 ** minorDigits(t.currency);
  if (t.mode === 'extra') {
    return [
      { label: money(1000 * unit), amount: 1000 * unit },
      { label: money(5000 * unit), amount: 5000 * unit },
      { label: `Pay off ${money(t.balance)}`, amount: t.balance },
    ];
  }
  return [
    { label: `Planned ${money(t.planned)}`, amount: t.planned },
    { label: `+${money(500 * unit)}`, amount: t.planned + 500 * unit },
    { label: `+${money(1000 * unit)}`, amount: t.planned + 1000 * unit },
    { label: 'Pay in full', amount: t.balance },
  ];
}

/** Live message under the amount: good = green, warn = amber. */
export function sheetImpact(t: SheetTarget, amount: Minor | null, money: (n: Minor) => string): { text: string; tone: 'good' | 'warn' } {
  if (amount === null || amount <= 0) return { text: 'Enter the amount you paid.', tone: 'warn' };
  if (amount >= t.balance) {
    return { text: `This clears ${t.name}! ${t.nextName ? `Your extra money moves to ${t.nextName} next.` : 'One debt down.'}`, tone: 'good' };
  }
  if (t.mode === 'extra') return { text: `${money(amount)} extra goes to your focus debt, ${t.name}.`, tone: 'good' };
  if (amount < t.minimum) {
    return { text: `That’s below the ${money(t.minimum)} minimum. Paying at least the minimum avoids late fees.`, tone: 'warn' };
  }
  const diff = amount - t.planned;
  if (diff > 0) return { text: `${money(diff)} more than planned. It all goes to your balance.`, tone: 'good' };
  if (diff < 0) return { text: `${money(-diff)} less than planned. Your plan will adjust next month.`, tone: 'warn' };
  return { text: 'Right on plan. Nice.', tone: 'good' };
}

/** "Paid ₱5,535 · as planned" / "· ₱465 extra" / "· ₱35 short". */
export function paidText(paid: Minor, planned: Minor, money: (n: Minor) => string): string {
  const diff = paid - planned;
  const tail = diff > 0 ? `${money(diff)} extra` : diff < 0 ? `${money(-diff)} short` : 'as planned';
  return `Paid ${money(paid)} · ${tail}`;
}

/** Regular payments on a debt this month that haven't been undone yet. Undo reverses all of them. */
export function undoablePayments(txs: TransactionRow[], debtId: string, month: YearMonth): string[] {
  const reversed = new Set(txs.map((t) => t.reversesId));
  return txs
    .filter((t) => t.debtId === debtId && t.type === 'payment' && t.planMonth === month && !t.isExtra && !reversed.has(t.id))
    .map((t) => t.id);
}

/** Prefill for the amount field: "5,535" / "5,535.50" (parseMoney reads it back). */
export function amountInputText(minor: Minor, currency: string): string {
  const digits = minor % 10 ** minorDigits(currency) === 0 ? 0 : minorDigits(currency);
  return new Intl.NumberFormat('en', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 10 ** minorDigits(currency));
}

/**
 * Logs a payment against this month's plan. Returns true when the debt's paid-off state changed
 * (caller reschedules reminders).
 */
export function savePayment(db: Db, t: Pick<SheetTarget, 'debtId' | 'mode'>, amount: Minor, month: YearMonth, on: string): boolean {
  if (!(Number.isSafeInteger(amount) && amount > 0)) throw new Error('Payment must be a positive amount');
  return db.transaction((tx) => {
    addTransaction(tx, { debtId: t.debtId, type: 'payment', amountMinor: -amount, occurredOn: on, planMonth: month, isExtra: t.mode === 'extra' });
    return syncPaidOff(tx, t.debtId, on);
  });
}

/** Undo = a reversal row for each of this month's regular payments on the debt. Same return as savePayment. */
export function undoPayment(db: Db, debtId: string, month: YearMonth, on: string): boolean {
  return db.transaction((tx) => {
    for (const id of undoablePayments(listTransactions(tx, debtId), debtId, month)) reverseTransaction(tx, id, on);
    return syncPaidOff(tx, debtId, on);
  });
}

/** Sets or clears `paid_off_on` from the balance. Returns true when it changed. */
export function syncPaidOff(db: Db, debtId: string, on: string): boolean {
  const done = balanceOf(db, debtId) <= 0;
  if (done === Boolean(getDebt(db, debtId)?.paidOffOn)) return false;
  updateDebt(db, debtId, { paidOffOn: done ? on : null });
  return true;
}

/**
 * Paid-off moment shows once per debt: true only when the balance is at zero now and never reached
 * zero before (in write order). Undo + re-pay doesn't show it again. Derived, nothing stored (D12).
 */
export function firstPayoff(db: Db, debtId: string): boolean {
  // listTransactions is newest first; reversed + stable sort keeps same-millisecond rows oldest first.
  const txs = listTransactions(db, debtId)
    .reverse()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let bal = 0;
  let hits = 0;
  for (const t of txs) {
    const before = bal;
    bal += t.amountMinor;
    if (before > 0 && bal <= 0) hits++;
  }
  return bal <= 0 && hits === 1;
}
