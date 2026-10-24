import { listDebts } from '@/db/repositories/debts';
import { getSettings, relabelCurrency, updateSettings } from '@/db/repositories/settings';
import type { Db } from '@/db/schema';

import { minorDigits } from './format';

// Home currency choices (CLAUDE.md §15). Names in English until i18n.
export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'PHP', name: 'Philippine peso' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' },
  { code: 'QAR', name: 'Qatari riyal' },
  { code: 'KWD', name: 'Kuwaiti dinar' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'TWD', name: 'New Taiwan dollar' },
  { code: 'MYR', name: 'Malaysian ringgit' },
];

export function currencyName(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.name ?? code;
}

export type RelabelResult = 'done' | 'same' | 'different_decimals';

/**
 * "I picked the wrong currency": every home-currency amount keeps its number, only the code changes.
 * Blocked between currencies with different decimals (PHP 2 → JPY 0) once debts exist, since the
 * stored minor units would change meaning.
 */
export function relabelHomeCurrency(db: Db, to: string): RelabelResult {
  const from = getSettings(db).homeCurrency;
  if (from === to) return 'same';
  if (minorDigits(from) !== minorDigits(to)) {
    if (listDebts(db, { includeArchived: true }).length > 0) return 'different_decimals';
    updateSettings(db, { budgetMinor: null }); // its minor units would mean something else
  }
  relabelCurrency(db, from, to);
  return 'done';
}
