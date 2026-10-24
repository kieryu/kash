// eslint-disable-next-line import/no-named-as-default -- big.js types use `export =`
import Big from 'big.js';

import { explainLine } from '@/engine/simulate';
import type { DebtMonth, EngineDebt, Minor } from '@/engine/types';

import { currencySymbol } from './dashboard';
import { formatMoney, formatPercent, minorDigits } from './format';

// "How was this calculated?" (§7): the inputs and formula behind one debt's month in the plan.

export type ExplainRow = { label: string; formula: string; result: string };

export function explainRows(debt: EngineDebt, line: DebtMonth, locale?: string): ExplainRow[] {
  const e = explainLine(debt, line);
  const money = (n: Minor) => formatMoney(n, debt.currency, locale);
  const r = e.minimum.rule;
  const bal = money(e.minimum.balance);
  let min =
    r.kind === 'installment'
      ? `Fixed monthly payment ${money(r.payment)}`
      : r.kind === 'fixed'
        ? `Fixed minimum ${money(r.amount)}`
        : r.kind === 'percent'
          ? `${formatPercent(r.percent)} × ${bal}, rounded half-up`
          : `Higher of ${formatPercent(r.percent)} × ${bal} or ${money(r.floor)}`;
  if (e.minimum.result === e.minimum.balance && e.minimum.balance > 0) min += ', capped at the balance';
  // Unrounded interest in major units, so the rounding step is visible ("₱80.1315 → ₱80.13").
  const exact = new Big(e.interest.exact).div(10 ** minorDigits(debt.currency)).toFixed();
  return [
    { label: 'Balance at the start of the month', formula: 'Sum of everything logged before this month', result: money(line.opening) },
    { label: 'Minimum due', formula: min, result: money(e.minimum.result) },
    {
      label: 'Planned payment',
      formula: `${money(e.payment.minimum)} minimum + ${money(e.payment.extra)} extra${line.isTarget ? ' (focus debt)' : ''}`,
      result: money(e.payment.total),
    },
    {
      label: 'Interest',
      formula: `(${money(line.opening)} − ${money(e.payment.total)}) × ${formatPercent(e.interest.rate)} a month = ${currencySymbol(debt.currency, locale)}${exact}, rounded half-up`,
      result: money(e.interest.result),
    },
    {
      label: 'Balance after this month',
      formula: `${money(e.closing.opening)} − ${money(e.closing.paid)} + ${money(e.closing.interest)}`,
      result: money(e.closing.result),
    },
  ];
}
