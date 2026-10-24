import { integer, sqliteTable, text, type BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

// Drizzle's view of the tables, for typed queries. The real DDL (with CHECKs and triggers) is in
// migrations.ts; a test keeps the two in step. Conventions: PLAN.md "DB schema".

export const DEBT_KINDS = [
  'credit_card',
  'card_installment',
  'personal_loan',
  'government_loan',
  'bnpl',
  'informal',
  'other',
] as const;
export const TX_TYPES = [
  'opening',
  'payment',
  'charge',
  'interest_fee',
  'statement_adjustment',
  'correction',
  'reversal',
] as const;
export const CHECKIN_REASONS = ['interest_fees', 'new_charges', 'unlogged_payment'] as const;

const bool = (name: string) => integer(name, { mode: 'boolean' });

export const debts = sqliteTable('debts', {
  id: text('id').primaryKey(),
  nickname: text('nickname').notNull(),
  kind: text('kind', { enum: DEBT_KINDS }).notNull(),
  issuer: text('issuer'),
  templateId: text('template_id'),
  color: text('color').notNull(),
  currency: text('currency').notNull(),
  monthlyRate: text('monthly_rate').notNull(),
  rateEnteredAs: text('rate_entered_as', { enum: ['monthly', 'annual'] }).notNull(),
  // Revolving debts: minimum rule. Installments: amortization + interest method.
  minRule: text('min_rule', { enum: ['fixed', 'percent', 'percent_or_fixed'] }),
  minPercent: text('min_percent'),
  minFixedMinor: integer('min_fixed_minor'),
  amortizationMinor: integer('amortization_minor'),
  interestMethod: text('interest_method', { enum: ['baked_in', 'diminishing'] }),
  acceptsExtra: bool('accepts_extra').notNull(),
  statementDay: integer('statement_day'),
  dueDay: integer('due_day'),
  creditLimitMinor: integer('credit_limit_minor'),
  lateFeeMinor: integer('late_fee_minor'),
  promoRate: text('promo_rate'),
  promoEndsOn: text('promo_ends_on'),
  autoDeducted: bool('auto_deducted').notNull(),
  sortOrder: integer('sort_order').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  archivedAt: text('archived_at'),
  paidOffOn: text('paid_off_on'),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  debtId: text('debt_id').notNull(),
  type: text('type', { enum: TX_TYPES }).notNull(),
  amountMinor: integer('amount_minor').notNull(), // + increases debt, − reduces
  currency: text('currency').notNull(),
  occurredOn: text('occurred_on').notNull(),
  planMonth: text('plan_month'),
  isExtra: bool('is_extra').notNull(),
  reversesId: text('reverses_id'),
  note: text('note'),
  createdAt: text('created_at').notNull(),
});

export const statementCheckins = sqliteTable('statement_checkins', {
  id: text('id').primaryKey(),
  debtId: text('debt_id').notNull(),
  statementDate: text('statement_date').notNull(),
  expectedMinor: integer('expected_minor').notNull(),
  statementMinor: integer('statement_minor').notNull(),
  reason: text('reason', { enum: CHECKIN_REASONS }),
  transactionId: text('transaction_id'),
  createdAt: text('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  homeCurrency: text('home_currency').notNull(),
  strategy: text('strategy', { enum: ['snowball', 'avalanche', 'custom'] }).notNull(),
  budgetMinor: integer('budget_minor'),
  planStartMonth: text('plan_start_month'),
  lockTimeoutSec: integer('lock_timeout_sec').notNull(),
  hideBalances: bool('hide_balances').notNull(),
  blockScreenshots: bool('block_screenshots').notNull(),
  reminderDaysBefore: integer('reminder_days_before').notNull(),
  lastBackupAt: text('last_backup_at'),
  onboardingDone: bool('onboarding_done').notNull(),
});

export const entitlement = sqliteTable('entitlement', {
  id: integer('id').primaryKey(),
  isPro: bool('is_pro').notNull(),
  source: text('source', { enum: ['play', 'test'] }),
  checkedAt: text('checked_at'),
});

export type DebtRow = typeof debts.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Entitlement = typeof entitlement.$inferSelect;

// Sync driver (expo-sqlite here, node:sqlite in tests).
export type Db = BaseSQLiteDatabase<'sync', unknown, typeof import('./schema')>;
