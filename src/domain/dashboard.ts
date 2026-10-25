import { listDebts } from '@/db/repositories/debts';
import { getEntitlement, getSettings } from '@/db/repositories/settings';
import { listTransactions } from '@/db/repositories/transactions';
import type { Db, DebtRow, Settings, TransactionRow } from '@/db/schema';
import { simulate, targetOrder, thisMonthPlan } from '@/engine/simulate';
import type { DebtMonth, Minor, PlanResult, Shortfall, YearMonth } from '@/engine/types';

import { currentYearMonth, formatMoney, formatYearMonth, monthsBetween, timeUntil } from './format';
import { minimumsFloor, planInput, readOnlyIds } from './plan';

// Dashboard and debt detail numbers, all derived from stored rows (D12).

export type Snapshot = {
  rows: DebtRow[];
  /** All transactions of `rows`. */
  txs: TransactionRow[];
  settings: Pick<Settings, 'strategy' | 'homeCurrency' | 'budgetMinor'>;
  /** Plan month = the current month. */
  month: YearMonth;
};

/** Active debts, their transactions and settings, for the current month. `readOnly` = over the free limit. */
export function loadSnapshot(db: Db): Snapshot & { settings: Settings; readOnly: Set<string> } {
  const rows = listDebts(db);
  return {
    rows,
    txs: rows.flatMap((r) => listTransactions(db, r.id)),
    settings: getSettings(db),
    month: currentYearMonth(),
    readOnly: readOnlyIds(rows, getEntitlement(db).isPro),
  };
}

export type LoadedSnapshot = ReturnType<typeof loadSnapshot>;

/** Balance per debt = sum of its transactions. */
export function balancesOf(txs: TransactionRow[]): Map<string, Minor> {
  const out = new Map<string, Minor>();
  for (const t of txs) out.set(t.debtId, (out.get(t.debtId) ?? 0) + t.amountMinor);
  return out;
}

/**
 * Money logged against `month`'s plan per debt (payments minus their undos; undos copy plan_month).
 * planned = regular payments, extra = "Log an extra payment".
 */
export function paidInMonth(txs: TransactionRow[], month: YearMonth): Map<string, { planned: Minor; extra: Minor }> {
  const out = new Map<string, { planned: Minor; extra: Minor }>();
  for (const t of txs) {
    if (t.planMonth !== month) continue;
    const p = out.get(t.debtId) ?? { planned: 0, extra: 0 };
    if (t.isExtra) p.extra -= t.amountMinor;
    else p.planned -= t.amountMinor;
    out.set(t.debtId, p);
  }
  return out;
}

/** Balances before anything was logged against this month's plan, so the plan doesn't shift as you pay. */
function monthStartBalances(s: Snapshot): Map<string, Minor> {
  return balancesOf(s.txs.filter((t) => t.planMonth !== s.month));
}

function input(s: Snapshot) {
  const base = planInput(s.rows, monthStartBalances(s), s.settings, 0, s.month);
  return { ...base, budget: s.settings.budgetMinor ?? minimumsFloor(base.debts) };
}

/** Monthly budget the plan uses: the saved one, else this month's minimums. */
export function budgetOf(s: Snapshot): Minor {
  return input(s).budget;
}

/** focusId = where extra money goes this month; nextFocusId = where it goes once that's cleared. */
export type MonthPlan = { lines: DebtMonth[]; shortfall: Shortfall | null; focusId: string | null; nextFocusId: string | null };

/** What to pay on each debt this month. On a shortfall, lines are the minimums. */
export function monthPlan(s: Snapshot): MonthPlan {
  const i = input(s);
  const r = thisMonthPlan(i);
  if ('status' in r) {
    const mins = thisMonthPlan({ ...i, budget: minimumsFloor(i.debts) });
    return { lines: 'status' in mins ? [] : mins.lines, shortfall: r, focusId: null, nextFocusId: null };
  }
  const extraTaking = i.debts.filter((d) => d.acceptsExtra && d.balance > 0);
  const order = targetOrder(extraTaking, i.strategy, (id) => i.debts.find((d) => d.id === id)!.balance, i.start);
  return { lines: r.lines, shortfall: null, focusId: r.lines.find((l) => l.isTarget)?.debtId ?? null, nextFocusId: order[1]?.id ?? null };
}

export function plannedAmount(line: DebtMonth): Minor {
  return line.paidMinimum + line.paidExtra;
}

/**
 * Payoff projection from the start of this month, assuming the rest of this month's plan gets paid.
 * Anything paid above a debt's planned amount counts as a one-off extra this month.
 */
// ponytail: overpaying a non-focus debt is treated as extra for the focus debt; per-debt overrides if it matters.
export function projection(s: Snapshot): PlanResult {
  const i = input(s);
  const plan = monthPlan(s);
  const paid = paidInMonth(s.txs, s.month);
  let extra = 0;
  for (const [id, p] of paid) {
    const line = plan.lines.find((l) => l.debtId === id);
    extra += Math.max(0, p.planned + p.extra - (line ? plannedAmount(line) : 0));
  }
  return simulate({ ...i, extras: extra > 0 ? [{ month: s.month, amount: extra }] : [] });
}

/** % paid off = paid ÷ (paid + remaining) (D12). Paid = payments net of undos. */
export function progress(txs: TransactionRow[]): { paid: Minor; remaining: Minor; ratio: number } {
  const byId = new Map(txs.map((t) => [t.id, t]));
  let paid = 0;
  for (const t of txs) {
    if (t.type === 'payment' || (t.type === 'reversal' && byId.get(t.reversesId ?? '')?.type === 'payment')) paid -= t.amountMinor;
  }
  let remaining = 0;
  for (const b of balancesOf(txs).values()) remaining += Math.max(0, b);
  const total = paid + remaining;
  return { paid, remaining, ratio: total > 0 ? paid / total : 0 };
}

export type Movement = { months: number; interest: Minor; isPayment: boolean };

/** How the latest change moved the plan: projection with vs. without it (D12). */
export function movement(s: Snapshot): Movement | null {
  const reversed = new Set(s.txs.map((t) => t.reversesId).filter(Boolean));
  const latest = s.txs
    .filter((t) => t.type !== 'opening' && t.type !== 'reversal' && !reversed.has(t.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return null;
  const now = projection(s);
  const before = projection({ ...s, txs: s.txs.filter((t) => t.id !== latest.id) });
  if (now.status !== 'ok' || before.status !== 'ok') return null;
  return {
    months: monthsBetween(now.debtFree, before.debtFree),
    interest: before.totals.interest - now.totals.interest,
    isPayment: latest.amountMinor < 0,
  };
}

export function movementText(m: Movement | null, money: (n: Minor) => string): string | null {
  if (!m) return null;
  const months = (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`;
  if (m.months > 0) return `↑ Your last payment moved you ${months(m.months)} closer`;
  if (m.months < 0) return `Your debt-free date moved ${months(-m.months)} later. An extra payment can win it back.`;
  if (!m.isPayment) return null;
  if (m.interest > 0) return `↑ Your last payment saves about ${money(m.interest)} in interest`;
  return '✓ Your last payment was right on plan';
}

// --- Dates (local 'YYYY-MM-DD') ---

function lastDay(ym: YearMonth): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Day `day` of a month, clamped to its last day. */
export function dayOf(ym: YearMonth, day: number): string {
  return `${ym}-${String(Math.min(day, lastDay(ym))).padStart(2, '0')}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function nextMonth(ym: YearMonth): YearMonth {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Next due date on or after today. */
export function nextDueDate(dueDay: number | null, today: string): string | null {
  if (!dueDay) return null;
  const here = dayOf(today.slice(0, 7), dueDay);
  return here >= today ? here : dayOf(nextMonth(today.slice(0, 7)), dueDay);
}

/** "Oct 28". */
export function shortDate(date: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(Date.parse(`${date}T00:00:00Z`));
}

/** "Due Oct 28" or, with `withDays`, "Due Oct 28 · in 8 days". */
export function dueText(date: string | null, today: string, withDays = false): string {
  if (!date) return 'No due date';
  const days = daysBetween(today, date);
  if (!withDays) return days === 0 ? 'Due today' : `Due ${shortDate(date)}`;
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  return days === 0 ? 'Due today' : `Due ${shortDate(date)} · ${when}`;
}

/** Projected payoff day: the debt's due day in its payoff month, else the month's last day. */
export function payoffDate(month: YearMonth, dueDay: number | null): string {
  return dayOf(month, dueDay ?? 31);
}

export const COUNTDOWN_DAYS = 90;

/**
 * §17: month and year first ("March 2028" / "in about 2 years 5 months");
 * a day count only in the final stretch (≤ 90 days: "47 days" / "around Dec 27").
 */
export function countdown(today: string, date: string): { big: string; sub: string; inDays: boolean } {
  const days = daysBetween(today, date);
  if (days <= COUNTDOWN_DAYS) {
    return { big: days <= 0 ? 'This month' : `${days} ${days === 1 ? 'day' : 'days'}`, sub: `around ${shortDate(date)}`, inDays: true };
  }
  return { big: formatYearMonth(date.slice(0, 7)), sub: timeUntil(today.slice(0, 7), date.slice(0, 7)), inDays: false };
}

/** Formatted money, or "₱ • • • •" when balances are hidden. */
export function moneyText(minor: Minor, currency: string, hide: boolean, locale?: string): string {
  return hide ? `${currencySymbol(currency, locale)} • • • •`.trim() : formatMoney(minor, currency, locale);
}

/** "₱" for PHP. */
export function currencySymbol(currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? '';
}

/** Overall debt-free day: the latest projected payoff day across debts. */
export function debtFreeDate(rows: DebtRow[], plan: Extract<PlanResult, { status: 'ok' }>): string {
  const dates = rows.filter((r) => plan.perDebt[r.id]).map((r) => payoffDate(plan.perDebt[r.id].payoff, r.dueDay));
  return dates.sort().at(-1) ?? payoffDate(plan.debtFree, null);
}

// --- Debts tab ---

export type DebtsListItem = { debt: DebtRow; balance: Minor; isFocus: boolean; payoffText: string };

/**
 * Debts tab: active debts in plan order (focus first, then by projected payoff), paid-off ones apart,
 * total left and this month's minimums.
 */
export function debtsList(s: Snapshot, today: string) {
  const bal = balancesOf(s.txs);
  const plan = monthPlan(s);
  const result = projection(s);
  const payoff = (id: string) => (result.status === 'ok' ? result.perDebt[id]?.payoff : undefined);
  const open = s.rows.filter((r) => (bal.get(r.id) ?? 0) > 0);
  const rank = (r: DebtRow) => (r.id === plan.focusId ? '' : (payoff(r.id) ?? '9999-99'));
  const active: DebtsListItem[] = [...open]
    .sort((a, b) => rank(a).localeCompare(rank(b)) || a.sortOrder - b.sortOrder)
    .map((debt) => {
      const month = payoff(debt.id);
      let payoffText = 'No payoff date at this budget yet';
      if (month) {
        const c = countdown(today, payoffDate(month, debt.dueDay));
        payoffText = !c.inDays ? `Paid off around ${c.big}` : c.big === 'This month' ? 'Paid off this month' : `Paid off in ${c.big}`;
      }
      return { debt, balance: bal.get(debt.id)!, isFocus: debt.id === plan.focusId, payoffText };
    });
  return {
    active,
    paidOff: s.rows.filter((r) => !open.includes(r)),
    totalLeft: active.reduce((sum, i) => sum + i.balance, 0),
    minimums: plan.lines.reduce((sum, l) => sum + l.minimumDue, 0),
  };
}

/** "Paid off Oct 2026". */
export function paidOffText(r: DebtRow): string {
  return r.paidOffOn ? `Paid off ${formatYearMonth(r.paidOffOn.slice(0, 7), undefined, 'short')}` : 'Paid off';
}
