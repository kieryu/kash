// eslint-disable-next-line import/no-named-as-default -- big.js types use `export =`
import Big from 'big.js';

import type { DecimalStr, Minor, YearMonth } from './types';

/** amount × rate, rounded half-up to the minor unit (D11). */
export function times(amount: Minor, rate: DecimalStr): Minor {
  return Number(new Big(amount).times(rate).round(0, Big.roundHalfUp));
}

/** amount × rate before rounding, for "how was this calculated?". */
export function timesExact(amount: Minor, rate: DecimalStr): string {
  return new Big(amount).times(rate).toFixed();
}

export function compareRates(a: DecimalStr, b: DecimalStr): number {
  return new Big(a).cmp(b);
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${String(Math.floor(t / 12)).padStart(4, '0')}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function assertMinor(n: number, what: string): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${what} must be a non-negative integer, got ${n}`);
}

export function assertRate(r: DecimalStr, what: string): void {
  let ok = false;
  try {
    ok = new Big(r).gte(0);
  } catch {}
  if (!ok) throw new Error(`${what} must be a non-negative decimal string, got ${r}`);
}

export function assertYearMonth(ym: YearMonth, what: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) throw new Error(`${what} must be YYYY-MM, got ${ym}`);
}
