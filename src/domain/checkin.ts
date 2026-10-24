import { recordCheckIn } from '@/db/repositories/checkins';
import type { CHECKIN_REASONS, Db, TransactionRow } from '@/db/schema';
import { addMonths } from '@/engine/money';
import type { Minor, PlanResult } from '@/engine/types';

import { balancesOf, dayOf, projection, type Snapshot } from './dashboard';
import { formatYearMonth } from './format';
import { syncPaidOff } from './payments';

// 10 Statement check-in: the difference from the expected balance becomes one transaction (§8, D8).

export type CheckInReason = (typeof CHECKIN_REASONS)[number];

export const REASON_LABELS: Record<CheckInReason, string> = {
  interest_fees: 'Interest & fees',
  new_charges: 'New purchases',
  unlogged_payment: 'A payment I didn’t log',
};

export const REASON_NOTES: Record<CheckInReason, string> = {
  interest_fees: 'Saved as interest and fees. Your projection corrects itself.',
  new_charges: 'Saved as new charges. Your plan now includes them.',
  unlogged_payment: 'Saved as a payment, so your history stays right.',
};

/** Reasons that fit the difference: higher → interest or purchases, lower → a payment. */
export function reasonsFor(difference: Minor): CheckInReason[] {
  if (difference > 0) return ['interest_fees', 'new_charges'];
  if (difference < 0) return ['unlogged_payment'];
  return [];
}

/** Most recent statement day on or before today; today when the debt has no statement day. */
export function statementDate(statementDay: number | null, today: string): string {
  if (!statementDay) return today;
  const here = dayOf(today.slice(0, 7), statementDay);
  return here <= today ? here : dayOf(addMonths(today.slice(0, 7), -1), statementDay);
}

/** Projection now vs. after saving this check-in (same rows recordCheckIn would write). */
export function checkInImpact(s: Snapshot, debtId: string, statementMinor: Minor, reason: CheckInReason | null, on: string) {
  const before = projection(s);
  const difference = statementMinor - (balancesOf(s.txs).get(debtId) ?? 0);
  if (difference === 0 || !reason) return { before, after: before };
  const tx: TransactionRow = {
    id: 'check-in-preview',
    debtId,
    type: reason === 'interest_fees' ? 'interest_fee' : reason === 'new_charges' ? 'charge' : 'payment',
    amountMinor: difference,
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

/** "Your debt-free date stays at December 2027." / "moves from … to …" + a tip when it slips. */
export function impactText(before: PlanResult, after: PlanResult, reason: CheckInReason | null): string {
  if (after.status === 'shortfall') return 'At this balance your minimums are more than your monthly budget. A higher budget keeps the plan on track.';
  if (after.status !== 'ok') return 'At this balance, interest outpaces your payments. A higher monthly amount gets you a debt-free date.';
  const to = formatYearMonth(after.debtFree);
  if (before.status !== 'ok') return `You have a debt-free date again: ${to}.`;
  const from = formatYearMonth(before.debtFree);
  if (after.debtFree === before.debtFree) return `Your debt-free date stays at ${from}.`;
  if (after.debtFree < before.debtFree) return `Debt-free date moves from ${from} to ${to}. Nice.`;
  const tip = reason === 'new_charges' ? 'Pausing purchases on this card gets you back on track.' : 'An extra payment can win it back.';
  return `Debt-free date moves from ${from} to ${to}. ${tip}`;
}

/** Saves the check-in. Returns true when the debt's paid-off state changed (caller reschedules reminders). */
export function saveCheckIn(db: Db, debtId: string, statementMinor: Minor, reason: CheckInReason | null, on: string): boolean {
  return db.transaction((tx) => {
    recordCheckIn(tx, { debtId, statementDate: on, statementMinor, reason: reason ?? undefined });
    return syncPaidOff(tx, debtId, on);
  });
}
