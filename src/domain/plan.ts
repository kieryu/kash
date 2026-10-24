import type { DebtRow, Settings } from '@/db/schema';
import { minimumDue } from '@/engine/simulate';
import type { Currency, EngineDebt, Minor, PlanInput, YearMonth } from '@/engine/types';

import { toEngineDebts } from './engineDebts';
import { minorDigits } from './format';

/** Free tier holds this many debts; Pro removes the limit (§20). */
export const FREE_DEBT_LIMIT = 3;

export function canAddDebt(count: number, isPro: boolean): boolean {
  return isPro || count < FREE_DEBT_LIMIT;
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

/** Slider range and starting value for the budget screen (07). */
export function budgetRange(floor: Minor, step: Minor, saved: Minor | null) {
  const up = (n: Minor) => Math.ceil(n / step) * step;
  const max = Math.max(up(floor * 4), up(floor) + 10 * step);
  const start = saved !== null && saved >= floor ? Math.min(saved, max) : Math.min(up(floor), max);
  return { min: floor, max, start };
}
