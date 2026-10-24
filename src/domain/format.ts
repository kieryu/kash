// eslint-disable-next-line import/no-named-as-default -- big.js types use `export =`
import Big from 'big.js';

import type { Currency, DecimalStr, Minor, YearMonth } from '@/engine/types';

/** Minor-unit digits of a currency (PHP 2, JPY 0, KWD 3), from Intl. */
export function minorDigits(currency: Currency): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** "₱18,450" for whole amounts, "₱18,450.50" otherwise. `locale` undefined = device locale. */
export function formatMoney(minor: Minor, currency: Currency, locale?: string): string {
  const digits = minorDigits(currency);
  const whole = minor % 10 ** digits === 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : digits,
    maximumFractionDigits: whole ? 0 : digits,
  }).format(minor / 10 ** digits);
}

/**
 * Typed amount → minor units, or null if it isn't a plain non-negative amount.
 * Accepts "18450", "18,450.00", "₱18,450". Too many decimals for the currency = null.
 */
// ponytail: assumes "." decimals and "," thousands; handle comma-decimal locales with i18n.
export function parseMoney(text: string, currency: Currency): Minor | null {
  const s = text.replace(/[^\d.,]/g, '').replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const minor = new Big(s).times(10 ** minorDigits(currency));
  if (!minor.eq(minor.round(0, Big.roundDown))) return null;
  const n = Number(minor);
  return Number.isSafeInteger(n) ? n : null;
}

/** "3" or "3.5%" (percent) → decimal string "0.03" / "0.035"; null if not a plain number. */
export function parsePercent(text: string): DecimalStr | null {
  const s = text.replace(/[%\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return new Big(s).div(100).toString();
}

/** "0.03" → "3%", for display. */
export function formatPercent(rate: DecimalStr): string {
  return `${new Big(rate).times(100).toString()}%`;
}

/** Annual rate shown next to the canonical monthly one: monthly × 12, nominal (D11). */
export function annualFromMonthly(rate: DecimalStr): DecimalStr {
  return new Big(rate).times(12).toString();
}

/** "March 2028". */
export function formatYearMonth(ym: YearMonth, locale?: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1));
}

export function currentYearMonth(now = new Date()): YearMonth {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthsBetween(from: YearMonth, to: YearMonth): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** "about 2 years 5 months" (§17: month/year first, never a big day count). */
export function durationText(months: number): string {
  if (months <= 0) return 'this month';
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? 'year' : 'years'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'month' : 'months'}`);
  return `in about ${parts.join(' ')}`;
}

/** Local date as 'YYYY-MM-DD'. */
export function today(now = new Date()): string {
  return `${currentYearMonth(now)}-${String(now.getDate()).padStart(2, '0')}`;
}
