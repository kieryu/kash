import type { Settings } from '@/db/schema';
import type { Minor, YearMonth } from '@/engine/types';

import { budgetOf, monthPlan, projection, type Snapshot } from './dashboard';
import { monthsBetween } from './format';
import { displayName } from './installments';

// 11 Compare strategies: the same snapshot and budget under each free strategy.

export type StrategyKey = Settings['strategy'];
export const STRATEGY_NAMES: Record<StrategyKey, string> = { snowball: 'Snowball', avalanche: 'Avalanche', custom: 'My own order' };
export type StrategyOutcome = { debtFree: YearMonth; interest: Minor; firstGone: YearMonth } | null;

/** Debt-free month, total interest and first payoff month; null when there's no debt-free date at this budget. */
export function outcome(s: Snapshot, strategy: StrategyKey): StrategyOutcome {
  const r = projection({ ...s, settings: { ...s.settings, strategy } });
  if (r.status !== 'ok') return null;
  // Debts already at zero have nothing paid in the plan; they don't count as "first gone".
  const payoffs = Object.values(r.perDebt).filter((d) => d.paid > 0).map((d) => d.payoff).sort();
  return { debtFree: r.debtFree, interest: r.totals.interest, firstGone: payoffs[0] ?? r.debtFree };
}

export type Breakdown = {
  /** Debts in the order they're paid off, with their share of the interest. */
  order: { id: string; name: string; payoff: YearMonth; interest: Minor }[];
  /** This month: minimum + extra per debt. */
  lines: { id: string; name: string; minimum: Minor; extra: Minor; isTarget: boolean }[];
  budget: Minor;
  minimums: Minor;
  interest: Minor;
  debtFree: YearMonth;
};

/** R7: the numbers behind a strategy's result, from the user's own debts; null when there's no debt-free date. */
export function breakdown(s: Snapshot, strategy: StrategyKey): Breakdown | null {
  const snap = { ...s, settings: { ...s.settings, strategy } };
  const r = projection(snap);
  if (r.status !== 'ok') return null;
  const name = (id: string) => displayName(s.rows, id);
  const order = Object.entries(r.perDebt)
    .filter(([, d]) => d.paid > 0)
    .map(([id, d]) => ({ id, name: name(id), payoff: d.payoff, interest: d.interest }))
    .sort((a, b) => a.payoff.localeCompare(b.payoff));
  const lines = monthPlan(snap)
    .lines.filter((l) => l.paidMinimum + l.paidExtra > 0)
    .map((l) => ({ id: l.debtId, name: name(l.debtId), minimum: l.paidMinimum, extra: l.paidExtra, isTarget: l.isTarget }));
  return {
    order,
    lines,
    budget: budgetOf(snap),
    minimums: lines.reduce((n, l) => n + l.minimum, 0),
    interest: r.totals.interest,
    debtFree: r.debtFree,
  };
}

/** "Avalanche saves about ₱860 and 1 month. Snowball clears your first debt 3 months sooner." */
export function tradeOff(snowball: StrategyOutcome, avalanche: StrategyOutcome, money: (n: Minor) => string): string {
  if (!snowball || !avalanche) return 'Raise your monthly budget to compare debt-free dates.';
  const months = (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`;
  const saved = snowball.interest - avalanche.interest;
  const faster = monthsBetween(avalanche.debtFree, snowball.debtFree);
  const first = monthsBetween(snowball.firstGone, avalanche.firstGone);
  // Usually only Avalanche saves; odd debt mixes can flip either number.
  const saves = (name: string, interest: Minor, m: number) => {
    const what = [interest > 0 ? `about ${money(interest)}` : null, m > 0 ? months(m) : null].filter(Boolean).join(' and ');
    return what ? `${name} saves ${what}.` : null;
  };
  const parts = [
    saves('Avalanche', saved, faster),
    saves('Snowball', -saved, -faster),
    first > 0 ? `Snowball clears your first debt ${months(first)} sooner.` : null,
    first < 0 ? `Avalanche clears your first debt ${months(-first)} sooner.` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : 'For your debts, both orders end up about the same. Pick the one that keeps you going.';
}
