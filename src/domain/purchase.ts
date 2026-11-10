import { addTransaction } from '@/db/repositories/transactions';
import type { Db, DebtRow, TransactionRow } from '@/db/schema';
import type { Minor, PlanResult } from '@/engine/types';

import { projection, type Snapshot } from './dashboard';
import { formatYearMonth, monthsBetween } from './format';
import { syncPaidOff } from './payments';

// Log a purchase (R24, §8): the card was used again. One `charge` row; the plan recalculates.

/** Revolving credit cards only. Installments and loans don't take new purchases. */
export function canLogPurchase(d: Pick<DebtRow, 'kind' | 'amortizationMinor'>): boolean {
  return d.kind === 'credit_card' && d.amortizationMinor == null;
}

/** Projection now vs. after saving this purchase (the same row savePurchase writes). */
export function purchasePreview(s: Snapshot, debtId: string, amount: Minor, on: string): { before: PlanResult; after: PlanResult } {
  const before = projection(s);
  if (!(amount > 0)) return { before, after: before };
  const tx: TransactionRow = {
    id: 'purchase-preview',
    debtId,
    type: 'charge',
    amountMinor: amount,
    currency: s.settings.homeCurrency,
    occurredOn: on,
    planMonth: null,
    isExtra: false,
    reversesId: null,
    note: null,
    createdAt: new Date().toISOString(),
  };
  return { before, after: projection({ ...s, txs: [...s.txs, tx] }) };
}

/** Live message under the amount. Neutral, never shaming (§11, §17): what moves, plus one tip. */
export function purchaseImpact(before: PlanResult, after: PlanResult, amount: Minor | null): { text: string; tone: 'good' | 'warn' } {
  if (amount === null || amount <= 0) return { text: 'Enter the amount you spent.', tone: 'warn' };
  if (after.status === 'shortfall') {
    return {
      text: 'With this purchase your minimums are more than your monthly budget. A higher budget keeps the plan on track.',
      tone: 'warn',
    };
  }
  if (after.status !== 'ok')
    return {
      text: 'With this purchase, interest outpaces your payments. A higher monthly amount gets you a debt-free date.',
      tone: 'warn',
    };
  if (before.status !== 'ok')
    return {
      text: `Your plan includes it. Debt-free by ${formatYearMonth(after.debtFree)}.`,
      tone: 'warn',
    };
  const later = monthsBetween(before.debtFree, after.debtFree);
  if (later <= 0)
    return {
      text: `Your plan includes it. Your debt-free date stays at ${formatYearMonth(after.debtFree)}.`,
      tone: 'good',
    };
  const months = later === 1 ? 'about 1 month' : `about ${later} months`;
  return {
    text: `This moves your debt-free date ${months} later, to ${formatYearMonth(after.debtFree)}. An extra payment can win it back.`,
    tone: 'warn',
  };
}

/** Saves the purchase. Returns true when the paid-off state changed (a cleared card is in use again). */
export function savePurchase(db: Db, debtId: string, amount: Minor, on: string): boolean {
  if (!(Number.isSafeInteger(amount) && amount > 0)) throw new Error('Purchase must be a positive amount');
  return db.transaction((tx) => {
    addTransaction(tx, {
      debtId,
      type: 'charge',
      amountMinor: amount,
      occurredOn: on,
    });
    return syncPaidOff(tx, debtId, on);
  });
}
