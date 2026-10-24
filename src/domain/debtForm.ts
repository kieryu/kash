import type { NewDebt } from '@/db/repositories/debts';
import type { DebtRow } from '@/db/schema';
import templates from '@/data/cardTemplates.json';
import type { Currency, Minor } from '@/engine/types';

import { looksLikeCardNumber } from './cardNumber';
import { installmentBalance } from './engineDebts';
import { parseMoney, parsePercent } from './format';

// Add-a-debt form (screen 06): the segment picks the fields, templates and stored kind.

export type Segment = 'card' | 'installment' | 'loan' | 'other';
export type Template = (typeof templates)[number];

export const SEGMENTS: readonly { value: Segment; label: string; kindLabel: string }[] = [
  { value: 'card', label: 'Card', kindLabel: 'Credit card' },
  { value: 'installment', label: 'Installment', kindLabel: 'Installment' },
  { value: 'loan', label: 'Loan', kindLabel: 'Loan' },
  { value: 'other', label: 'Other', kindLabel: 'Other' },
];

const TEMPLATE_KINDS: Record<Segment, string[]> = {
  card: ['credit_card'],
  installment: ['bnpl', 'credit_card'],
  loan: ['personal_loan', 'government_loan'],
  other: ['informal'],
};
const CUSTOM_KIND: Record<Segment, DebtRow['kind']> = {
  card: 'credit_card',
  installment: 'card_installment',
  loan: 'personal_loan',
  other: 'other',
};

export const KIND_LABELS: Record<DebtRow['kind'], string> = {
  credit_card: 'Credit card',
  card_installment: 'Installment',
  personal_loan: 'Loan',
  government_loan: 'Government loan',
  bnpl: 'Buy now, pay later',
  informal: 'Family loan',
  other: 'Other',
};

export function templateById(id: string | null): Template | undefined {
  return templates.find((t) => t.id === id);
}

export const CUSTOM_TEMPLATE = templates.find((t) => t.id === 'custom')!;

/** Templates for a segment, "Custom" last. */
export function templatesFor(segment: Segment): Template[] {
  return [...templates.filter((t) => t.id !== 'custom' && TEMPLATE_KINDS[segment].includes(t.kind)), CUSTOM_TEMPLATE];
}

/** Fixed monthly payment for N months (installments and loans) vs. a revolving balance. */
export function isInstallment(segment: Segment): boolean {
  return segment === 'installment' || segment === 'loan';
}

export type DebtFormValues = {
  segment: Segment;
  templateId: string;
  color: string;
  nickname: string;
  // Revolving (card / other)
  balance: string;
  rate: string; // % per month
  minimum: string; // amount, or a percent like "3%"
  // Installment / loan
  payment: string;
  monthsLeft: string;
  dueDay: string;
};

export type DebtFormField = keyof DebtFormValues;
export type DebtFormResult =
  | { ok: true; debt: NewDebt; openingMinor: Minor }
  | { ok: false; errors: Partial<Record<DebtFormField, string>> };

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Validates the form and builds the DB row + opening balance. Rates are entered per month. */
export function parseDebtForm(v: DebtFormValues, currency: Currency): DebtFormResult {
  const errors: Partial<Record<DebtFormField, string>> = {};
  const tpl = templateById(v.templateId) ?? CUSTOM_TEMPLATE;
  const nickname = v.nickname.trim();

  if (!nickname) errors.nickname = 'Give it a name you’ll recognise.';
  else if (looksLikeCardNumber(nickname)) errors.nickname = 'This looks like a card number. Kash doesn’t need it — use a nickname instead.';
  if (!HEX.test(v.color)) errors.color = 'Use a color like #1E5B47.';

  const dueDay = v.dueDay.trim() === '' ? null : Number(v.dueDay.replace(/\D/g, ''));
  if (dueDay === null ? v.segment === 'card' : !(Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31)) {
    errors.dueDay = 'Enter a day from 1 to 31.';
  }

  const kind = tpl.id === 'custom' ? CUSTOM_KIND[v.segment] : v.segment === 'installment' && tpl.kind === 'credit_card' ? 'card_installment' : (tpl.kind as DebtRow['kind']);
  const base = {
    nickname,
    kind,
    issuer: tpl.id === 'custom' ? null : tpl.issuer,
    templateId: tpl.id,
    color: v.color.toUpperCase(),
    currency,
    rateEnteredAs: 'monthly' as const,
    dueDay,
    autoDeducted: false,
  };

  if (isInstallment(v.segment)) {
    const payment = parseMoney(v.payment, currency);
    const months = Number(v.monthsLeft.trim());
    if (!payment) errors.payment = 'Enter the monthly payment.';
    if (!(Number.isInteger(months) && months >= 1 && months <= 600)) errors.monthsLeft = 'Enter how many payments are left.';
    if (Object.keys(errors).length || !payment) return { ok: false, errors };
    // D4: baked-in interest, balance = what's left to pay; no extra money by default.
    return {
      ok: true,
      debt: { ...base, monthlyRate: '0', amortizationMinor: payment, interestMethod: 'baked_in', acceptsExtra: false },
      openingMinor: installmentBalance(payment, months),
    };
  }

  const optional = v.segment === 'other';
  const balance = parseMoney(v.balance, currency);
  if (balance === null) errors.balance = 'Enter the balance you owe.';
  const rate = optional && v.rate.trim() === '' ? '0' : parsePercent(v.rate);
  if (rate === null) errors.rate = 'Enter the monthly rate, e.g. 3%.';
  const min = optional && v.minimum.trim() === '' ? ({ minRule: 'fixed', minFixedMinor: 0 } as const) : parseMinimum(v.minimum, currency);
  if (!min) errors.minimum = 'Enter an amount, or a percent like 3%.';
  if (Object.keys(errors).length || balance === null || rate === null || !min) return { ok: false, errors };
  return { ok: true, debt: { ...base, monthlyRate: rate, ...min, acceptsExtra: true }, openingMinor: balance };
}

function parseMinimum(text: string, currency: Currency) {
  if (text.includes('%')) {
    const pct = parsePercent(text);
    return pct && Number(pct) > 0 && Number(pct) <= 1 ? ({ minRule: 'percent', minPercent: pct } as const) : null;
  }
  const amount = parseMoney(text, currency);
  return amount ? ({ minRule: 'fixed', minFixedMinor: amount } as const) : null;
}
