import { addMonths, assertMinor, assertRate, assertYearMonth, compareRates, times, timesExact } from './money';
import type {
  DebtId,
  DebtMonth,
  DecimalStr,
  EngineDebt,
  Minor,
  PlanInput,
  PlanMonth,
  PlanResult,
  Shortfall,
  Strategy,
  YearMonth,
} from './types';

const DEFAULT_MAX_MONTHS = 600;
// ponytail: balances this large mean interest has run away; stop before Number loses precision.
const RUNAWAY_TOTAL = 1e15;

/** Month-by-month payoff plan. Every result is an estimate (CLAUDE.md §7, D2, D4). */
export function simulate(input: PlanInput): PlanResult {
  validate(input);
  const maxMonths = input.maxMonths ?? DEFAULT_MAX_MONTHS;
  const balances = new Map(input.debts.map((d) => [d.id, d.balance]));
  const perDebt = Object.fromEntries(input.debts.map((d) => [d.id, { payoff: input.start, interest: 0, paid: 0 }]));
  const months: PlanMonth[] = [];
  let month = input.start;

  while (sum(balances.values()) > 0) {
    if (months.length >= maxMonths || sum(balances.values()) > RUNAWAY_TOTAL) {
      const debtIds = input.debts.filter((d) => balances.get(d.id)! > 0).map((d) => d.id);
      return { status: 'neverPaysOff', debtIds, monthsSimulated: months.length };
    }
    const planMonth = simulateMonth(input, balances, month);
    if ('status' in planMonth) return planMonth;
    for (const line of planMonth.lines) {
      balances.set(line.debtId, line.closing);
      const d = perDebt[line.debtId];
      d.interest += line.interest;
      d.paid += line.paidMinimum + line.paidExtra;
      if (line.closing === 0) d.payoff = month;
    }
    months.push(planMonth);
    month = addMonths(month, 1);
  }

  const totals = { interest: 0, paid: 0 };
  for (const d of Object.values(perDebt)) {
    totals.interest += d.interest;
    totals.paid += d.paid;
  }
  const debtFree = months.length ? months[months.length - 1].month : input.start;
  return { status: 'ok', months, debtFree, perDebt, totals };
}

/** What to pay on each debt in the start month. */
export function thisMonthPlan(input: PlanInput): PlanMonth | Shortfall {
  validate(input);
  return simulateMonth(input, new Map(input.debts.map((d) => [d.id, d.balance])), input.start);
}

/** Inputs and formulas behind one line of the schedule, for "How was this calculated?". */
export function explainLine(debt: EngineDebt, line: DebtMonth) {
  const paid = line.paidMinimum + line.paidExtra;
  const afterPayment = line.opening - paid;
  return {
    minimum: {
      rule: debt.kind === 'revolving' ? debt.minimum : { kind: 'installment' as const, payment: debt.payment },
      balance: line.opening,
      result: line.minimumDue,
    },
    payment: { minimum: line.paidMinimum, extra: line.paidExtra, total: paid },
    // interest = round half-up((opening − paid) × monthly rate)
    interest: {
      balance: afterPayment,
      rate: line.rateUsed,
      exact: timesExact(afterPayment, line.rateUsed),
      result: line.interest,
    },
    // closing = opening − paid + interest
    closing: { opening: line.opening, paid, interest: line.interest, result: line.closing },
  };
}

export function minimumDue(debt: EngineDebt, balance: Minor): Minor {
  if (debt.kind === 'installment') return Math.min(debt.payment, balance);
  const r = debt.minimum;
  const due =
    r.kind === 'fixed'
      ? r.amount
      : r.kind === 'percent'
        ? times(balance, r.percent)
        : Math.max(times(balance, r.percent), r.floor);
  return Math.min(due, balance);
}

export function rateFor(debt: EngineDebt, month: YearMonth): DecimalStr {
  if (debt.kind === 'installment' && debt.interest === 'bakedIn') return '0';
  if (debt.promo && month <= debt.promo.until) return debt.promo.monthlyRate;
  return debt.monthlyRate;
}

/** Order in which extra money is applied. Tie-breaks are deterministic (PLAN.md engine rules). */
export function targetOrder(debts: EngineDebt[], strategy: Strategy, balance: (id: DebtId) => Minor, month: YearMonth) {
  const rate = (d: EngineDebt) => rateFor(d, month);
  const rank = (d: EngineDebt) => {
    const i = strategy.kind === 'custom' ? strategy.order.indexOf(d.id) : -1;
    return i === -1 ? Infinity : i;
  };
  const cmp = (a: EngineDebt, b: EngineDebt): number => {
    if (strategy.kind === 'snowball')
      return balance(a.id) - balance(b.id) || compareRates(rate(b), rate(a)) || a.createdSeq - b.createdSeq;
    if (strategy.kind === 'avalanche')
      return compareRates(rate(b), rate(a)) || balance(a.id) - balance(b.id) || a.createdSeq - b.createdSeq;
    return rank(a) - rank(b) || a.createdSeq - b.createdSeq;
  };
  return [...debts].sort(cmp);
}

// D2: minimum from opening balance → pay → accrue interest on the remainder.
function simulateMonth(input: PlanInput, balances: Map<DebtId, Minor>, month: YearMonth): PlanMonth | Shortfall {
  const active = input.debts.filter((d) => balances.get(d.id)! > 0);
  const lines = new Map<DebtId, DebtMonth>();
  let minimumsTotal = 0;
  for (const d of active) {
    const opening = balances.get(d.id)!;
    const min = minimumDue(d, opening);
    minimumsTotal += min;
    lines.set(d.id, {
      debtId: d.id,
      opening,
      minimumDue: min,
      paidMinimum: min,
      paidExtra: 0,
      interest: 0,
      principal: 0,
      closing: 0,
      rateUsed: rateFor(d, month),
      isTarget: false,
    });
  }
  if (minimumsTotal > input.budget) {
    return { status: 'shortfall', month, minimumsTotal, shortBy: minimumsTotal - input.budget };
  }

  let pool = input.budget - minimumsTotal;
  for (const e of input.extras ?? []) if (e.month === month) pool += e.amount;

  // Leftover after a target is cleared rolls to the next target in the same month.
  const targets = targetOrder(
    active.filter((d) => d.acceptsExtra),
    input.strategy,
    (id) => balances.get(id)!,
    month,
  );
  targets.forEach((d, i) => {
    const line = lines.get(d.id)!;
    line.isTarget = i === 0;
    const extra = Math.min(pool, line.opening - line.paidMinimum);
    line.paidExtra = extra;
    pool -= extra;
  });

  for (const line of lines.values()) {
    const paid = line.paidMinimum + line.paidExtra;
    line.interest = times(line.opening - paid, line.rateUsed);
    line.closing = line.opening - paid + line.interest;
    line.principal = paid - line.interest;
  }
  return { month, lines: [...lines.values()], unspent: pool };
}

function validate(input: PlanInput): void {
  assertMinor(input.budget, 'budget');
  assertYearMonth(input.start, 'start');
  if (input.maxMonths !== undefined && !(Number.isInteger(input.maxMonths) && input.maxMonths > 0)) {
    throw new Error(`maxMonths must be a positive integer, got ${input.maxMonths}`);
  }
  const ids = new Set<DebtId>();
  for (const d of input.debts) {
    if (ids.has(d.id)) throw new Error(`duplicate debt id ${d.id}`);
    ids.add(d.id);
    // Multi-currency = one run per currency (v1.1).
    if (d.currency !== input.currency) throw new Error(`debt ${d.id} is ${d.currency}, plan is ${input.currency}`);
    assertMinor(d.balance, `debt ${d.id} balance`);
    assertRate(d.monthlyRate, `debt ${d.id} monthlyRate`);
    if (d.promo) {
      assertRate(d.promo.monthlyRate, `debt ${d.id} promo rate`);
      assertYearMonth(d.promo.until, `debt ${d.id} promo until`);
    }
    if (d.kind === 'installment') assertMinor(d.payment, `debt ${d.id} payment`);
    else {
      const r = d.minimum;
      if (r.kind === 'fixed') assertMinor(r.amount, `debt ${d.id} minimum`);
      else assertRate(r.percent, `debt ${d.id} minimum percent`);
      if (r.kind === 'percentOrFixed') assertMinor(r.floor, `debt ${d.id} minimum floor`);
    }
  }
  for (const e of input.extras ?? []) {
    assertMinor(e.amount, 'extra amount');
    assertYearMonth(e.month, 'extra month');
  }
}

function sum(xs: Iterable<number>): number {
  let t = 0;
  for (const x of xs) t += x;
  return t;
}
