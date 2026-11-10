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

/**
 * Live formatting for a money field while typing: "18450.5" → "18,450.5". Keeps a trailing "." so the
 * user can type decimals, and drops decimals the currency doesn't have (JPY none, PHP 2). parseMoney reads it back.
 */
export function amountTyping(text: string, currency: Currency): string {
  const [int = '', ...rest] = text.replace(/[^\d.]/g, '').split('.');
  const whole = int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const digits = minorDigits(currency);
  if (rest.length === 0 || digits === 0) return whole;
  return `${whole || '0'}.${rest.join('').slice(0, digits)}`;
}

const significant = (c: string) => (c >= '0' && c <= '9') || c === '.';

/**
 * One keystroke in a money field: `prev` is what the field showed, `raw` what it holds after the edit.
 * Returns the re-formatted text and where the cursor goes, so editing mid-number keeps the cursor
 * next to the digit just typed ("1|2,400" + "5" → "15|2,400"). Backspacing over a comma deletes the
 * digit before it, as people expect.
 */
export function amountEdit(prev: string, raw: string, currency: Currency): { text: string; caret: number } {
  // Unchanged head and tail around the edit; the cursor sits where the tail starts. The head wins
  // when digits repeat ("999" → "9999"), so the cursor lands after the newest digit.
  let head = 0;
  while (head < prev.length && head < raw.length && prev[head] === raw[head]) head++;
  const room = Math.min(prev.length, raw.length) - head;
  let tail = 0;
  while (tail < room && prev[prev.length - 1 - tail] === raw[raw.length - 1 - tail]) tail++;
  const removed = prev.length - raw.length === 1 ? prev[prev.length - 1 - tail] : null;
  if (removed === ',') {
    const at = raw.length - tail; // comma was here; drop the digit before it too
    raw = raw.slice(0, Math.max(0, at - 1)) + raw.slice(at);
  }
  const before = [...raw.slice(0, raw.length - tail)].filter(significant).length;
  const text = amountTyping(raw, currency);
  let caret = 0;
  for (let seen = 0; caret < text.length && seen < before; caret++) if (significant(text[caret])) seen++;
  return { text, caret };
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

/** "March 2028", or "Mar 2028" with `month: 'short'`. */
export function formatYearMonth(ym: YearMonth, locale?: string, month: 'long' | 'short' = 'long'): string {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month, year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1));
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

/** "in about 1 year 2 months" from one month to another. Budget and dashboard both use this, so they agree. */
export function timeUntil(from: YearMonth, to: YearMonth): string {
  return durationText(monthsBetween(from, to));
}

/** Local date as 'YYYY-MM-DD'. */
export function today(now = new Date()): string {
  return `${currentYearMonth(now)}-${String(now.getDate()).padStart(2, '0')}`;
}
