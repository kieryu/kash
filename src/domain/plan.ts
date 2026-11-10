import type { DebtRow, Settings } from '@/db/schema';
import { minimumDue } from '@/engine/simulate';
import type { Currency, EngineDebt, Minor, PlanInput, YearMonth } from '@/engine/types';

import { toEngineDebts } from './engineDebts';
import { topLevel } from './installments';
import { minorDigits } from './format';

/** Free tier holds this many debts; Pro removes the limit (§20). */
export const FREE_DEBT_LIMIT = 3;

export function canAddDebt(count: number, isPro: boolean): boolean {
  return isPro || count < FREE_DEBT_LIMIT;
}

/** Debts that count toward the free limit: an installment on a card is part of that card (R20). */
export function debtCount(rows: Pick<DebtRow, 'parentDebtId'>[]): number {
  return topLevel(rows).length;
}

/**
 * Debts past the free limit (e.g. after a refund or importing a bigger backup) are read-only:
 * still shown and in every total and plan, but no new payments or check-ins (§20). Never hidden.
 * The first ones added keep working.
 */
export function readOnlyIds(rows: DebtRow[], isPro: boolean): Set<string> {
  if (isPro) return new Set();
  const out = new Set(topLevel([...rows].sort((a, b) => a.sortOrder - b.sortOrder)).slice(FREE_DEBT_LIMIT).map((r) => r.id));
  // Installments follow their card.
  for (const r of rows) if (r.parentDebtId && out.has(r.parentDebtId)) out.add(r.id);
  return out;
}

/** Engine input from stored data. Custom order = the debts' sort order. */
export function planInput(
  rows: DebtRow[],
  balances: Map<string, Minor>,
  s: Pick<Settings, 'strategy' | 'homeCurrency'>,
  budget: Minor,
  start: YearMonth,
): PlanInput {
  const strategy: PlanInput['strategy'] =
    s.strategy === 'custom'
      ? { kind: 'custom', order: [...rows].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.id) }
      : { kind: s.strategy };
  return { debts: toEngineDebts(rows, balances), budget, currency: s.homeCurrency, strategy, start };
}

/** The lowest budget that covers this month's minimums. */
export function minimumsFloor(debts: EngineDebt[]): Minor {
  return debts.reduce((sum, d) => sum + minimumDue(d, d.balance), 0);
}

// ponytail: fixed 500 major units (fits PHP); scale per currency when multi-currency lands.
export function budgetStep(currency: Currency): Minor {
  return 500 * 10 ** minorDigits(currency);
}

/**
 * Budget −/+ (R22): jump to the next round step up or down, so an odd amount like ₱22,546.79 becomes
 * ₱23,000 rather than ₱23,046.79. Never goes below the minimums (`floor`).
 */
export function budgetStepTo(current: Minor, dir: 1 | -1, step: Minor, floor: Minor): Minor {
  const next = dir === 1 ? (Math.floor(current / step) + 1) * step : (Math.ceil(current / step) - 1) * step;
  return Math.max(floor, next);
}

/** Slider range and starting value for the budget screen (07). */
export function budgetRange(floor: Minor, step: Minor, saved: Minor | null) {
  const up = (n: Minor) => Math.ceil(n / step) * step;
  const max = Math.max(up(floor * 4), up(floor) + 10 * step);
  const start = saved !== null && saved >= floor ? Math.min(saved, max) : Math.min(up(floor), max);
  return { min: floor, max, start };
}
