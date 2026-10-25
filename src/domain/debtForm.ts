import { updateDebt, type DebtPatch, type NewDebt } from '@/db/repositories/debts';
import { addTransaction } from '@/db/repositories/transactions';
import type { Db, DebtRow } from '@/db/schema';
import templates from '@/data/cardTemplates.json';
import type { Currency, Minor } from '@/engine/types';

import { looksLikeCardNumber } from './cardNumber';
import { installmentBalance } from './engineDebts';
import { formatPercent, parseMoney, parsePercent } from './format';
import { amountInputText, syncPaidOff } from './payments';

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

// --- Edit a debt (09 → Edit) ---

export function segmentOf(row: DebtRow): Segment {
  if (row.amortizationMinor != null) return row.kind === 'personal_loan' || row.kind === 'government_loan' ? 'loan' : 'installment';
  return row.kind === 'credit_card' ? 'card' : 'other';
}

/** The form prefilled from a stored debt. Payments left = balance ÷ payment, rounded up. */
export function formValuesOf(row: DebtRow, balance: Minor): DebtFormValues {
  const money = (n: number | null) => (n ? amountInputText(n, row.currency) : '');
  const minimum = row.minRule === 'fixed' ? money(row.minFixedMinor) : row.minPercent ? formatPercent(row.minPercent) : '';
  return {
    segment: segmentOf(row),
    templateId: row.templateId ?? CUSTOM_TEMPLATE.id,
    color: row.color,
    nickname: row.nickname,
    balance: amountInputText(Math.max(0, balance), row.currency),
    rate: formatPercent(row.monthlyRate),
    minimum,
    payment: money(row.amortizationMinor),
    monthsLeft: row.amortizationMinor ? String(Math.ceil(Math.max(0, balance) / row.amortizationMinor)) : '',
    dueDay: row.dueDay ? String(row.dueDay) : '',
  };
}

export type DebtEdit = { patch: DebtPatch; correction: Minor };

/**
 * Same rules as the add form. The balance itself isn't edited here (check-in or payment does that).
 * Installments: balance = payment × payments left, so changing either appends a correction row (D18).
 * Untouched fields stay as stored (e.g. a "% or ₱X" minimum the form can't show).
 */
export function parseDebtEdit(
  v: DebtFormValues,
  orig: DebtFormValues,
  balance: Minor,
  currency: Currency,
): { ok: true; edit: DebtEdit } | { ok: false; errors: Partial<Record<DebtFormField, string>> } {
  const monthsChanged = v.monthsLeft !== orig.monthsLeft;
  // Balance isn't on the edit form; unchanged months may be 0 (paid off), which the add form refuses.
  const r = parseDebtForm({ ...v, segment: orig.segment, balance: '1', monthsLeft: monthsChanged ? v.monthsLeft : '1' }, currency);
  if (!r.ok) return r;
  const d = r.debt;
  const patch: DebtPatch = { nickname: d.nickname, kind: d.kind, issuer: d.issuer, templateId: d.templateId, color: d.color, dueDay: d.dueDay };
  let correction = 0;
  if (isInstallment(orig.segment)) {
    const paymentChanged = v.payment !== orig.payment;
    if (paymentChanged) patch.amortizationMinor = d.amortizationMinor;
    if (paymentChanged || monthsChanged) correction = installmentBalance(d.amortizationMinor!, Number(v.monthsLeft.trim())) - Math.max(0, balance);
  } else {
    patch.monthlyRate = d.monthlyRate;
    if (v.minimum !== orig.minimum) Object.assign(patch, { minRule: d.minRule, minPercent: d.minPercent ?? null, minFixedMinor: d.minFixedMinor ?? null });
  }
  return { ok: true, edit: { patch, correction } };
}

/** Saves an edit in one transaction. Returns true when the paid-off state changed (caller reschedules reminders). */
export function saveDebtEdit(db: Db, id: string, edit: DebtEdit, on: string): boolean {
  return db.transaction((tx) => {
    updateDebt(tx, id, edit.patch);
    if (!edit.correction) return false;
    addTransaction(tx, { debtId: id, type: 'correction', amountMinor: edit.correction, occurredOn: on, note: 'Edited payment terms' });
    return syncPaidOff(tx, id, on);
  });
}
