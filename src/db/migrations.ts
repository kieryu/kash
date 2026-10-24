import { sql } from 'drizzle-orm';

import type { Db } from './schema';

// Forward-only. Never edit a shipped migration — append a new one. Index + 1 = PRAGMA user_version.
// One statement per string (SQLite drivers run a single statement per call).
export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE debts (
      id TEXT PRIMARY KEY NOT NULL,
      nickname TEXT NOT NULL CHECK (length(trim(nickname)) > 0),
      kind TEXT NOT NULL CHECK (kind IN ('credit_card','card_installment','personal_loan','government_loan','bnpl','informal','other')),
      issuer TEXT,
      template_id TEXT,
      color TEXT NOT NULL,
      currency TEXT NOT NULL CHECK (length(currency) = 3),
      monthly_rate TEXT NOT NULL,
      rate_entered_as TEXT NOT NULL CHECK (rate_entered_as IN ('monthly','annual')),
      min_rule TEXT CHECK (min_rule IN ('fixed','percent','percent_or_fixed')),
      min_percent TEXT,
      min_fixed_minor INTEGER CHECK (typeof(min_fixed_minor) IN ('integer','null') AND min_fixed_minor >= 0),
      amortization_minor INTEGER CHECK (typeof(amortization_minor) IN ('integer','null') AND amortization_minor > 0),
      interest_method TEXT CHECK (interest_method IN ('baked_in','diminishing')),
      accepts_extra INTEGER NOT NULL DEFAULT 0,
      statement_day INTEGER CHECK (statement_day BETWEEN 1 AND 31),
      due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
      credit_limit_minor INTEGER CHECK (typeof(credit_limit_minor) IN ('integer','null') AND credit_limit_minor >= 0),
      late_fee_minor INTEGER CHECK (typeof(late_fee_minor) IN ('integer','null') AND late_fee_minor >= 0),
      promo_rate TEXT,
      promo_ends_on TEXT,
      auto_deducted INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      paid_off_on TEXT,
      -- A debt is either revolving (minimum rule) or an installment (amortization + method), never both.
      CHECK ((min_rule IS NULL) <> (amortization_minor IS NULL)),
      CHECK ((amortization_minor IS NULL) = (interest_method IS NULL))
    )`,
    `CREATE TABLE transactions (
      id TEXT PRIMARY KEY NOT NULL,
      debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('opening','payment','charge','interest_fee','statement_adjustment','correction','reversal')),
      amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer'),
      currency TEXT NOT NULL,
      occurred_on TEXT NOT NULL,
      plan_month TEXT,
      is_extra INTEGER NOT NULL DEFAULT 0,
      reverses_id TEXT UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
      note TEXT,
      created_at TEXT NOT NULL,
      CHECK (type <> 'payment' OR amount_minor < 0),
      CHECK (type NOT IN ('charge','interest_fee') OR amount_minor > 0),
      CHECK (type <> 'opening' OR amount_minor >= 0),
      CHECK ((type = 'reversal') = (reverses_id IS NOT NULL))
    )`,
    `CREATE INDEX transactions_debt ON transactions(debt_id, occurred_on)`,
    // Append-only: history is corrected with reversal/correction rows, never edited (CLAUDE.md §8).
    `CREATE TRIGGER transactions_append_only BEFORE UPDATE ON transactions
      BEGIN SELECT RAISE(ABORT, 'transactions are append-only'); END`,
    `CREATE TABLE statement_checkins (
      id TEXT PRIMARY KEY NOT NULL,
      debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
      statement_date TEXT NOT NULL,
      expected_minor INTEGER NOT NULL,
      statement_minor INTEGER NOT NULL CHECK (typeof(statement_minor) = 'integer' AND statement_minor >= 0),
      reason TEXT CHECK (reason IN ('interest_fees','new_charges','unlogged_payment')),
      transaction_id TEXT REFERENCES transactions(id),
      created_at TEXT NOT NULL,
      CHECK ((reason IS NULL) = (transaction_id IS NULL))
    )`,
    `CREATE TABLE settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      home_currency TEXT NOT NULL DEFAULT 'PHP',
      strategy TEXT NOT NULL DEFAULT 'snowball' CHECK (strategy IN ('snowball','avalanche','custom')),
      budget_minor INTEGER CHECK (typeof(budget_minor) IN ('integer','null') AND budget_minor >= 0),
      plan_start_month TEXT,
      lock_timeout_sec INTEGER NOT NULL DEFAULT 60,
      hide_balances INTEGER NOT NULL DEFAULT 0,
      block_screenshots INTEGER NOT NULL DEFAULT 0,
      reminder_days_before INTEGER NOT NULL DEFAULT 3,
      last_backup_at TEXT,
      onboarding_done INTEGER NOT NULL DEFAULT 0
    )`,
    `INSERT INTO settings (id) VALUES (1)`,
    `CREATE TABLE entitlement (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_pro INTEGER NOT NULL DEFAULT 0,
      source TEXT CHECK (source IN ('play','test')),
      checked_at TEXT
    )`,
    `INSERT INTO entitlement (id) VALUES (1)`,
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export class DbTooNewError extends Error {
  constructor(found: number) {
    super(`Database schema v${found} is newer than this app (v${SCHEMA_VERSION}).`);
    this.name = 'DbTooNewError';
  }
}

/** Runs pending migrations, each in its own transaction. Refuses a DB from a newer app version. */
export function migrate(db: Db): void {
  const current = db.get<{ user_version: number }>(sql`PRAGMA user_version`).user_version;
  if (current > SCHEMA_VERSION) throw new DbTooNewError(current);
  for (let v = current; v < SCHEMA_VERSION; v++) {
    db.transaction((tx) => {
      for (const stmt of MIGRATIONS[v]) tx.run(sql.raw(stmt));
      tx.run(sql.raw(`PRAGMA user_version = ${v + 1}`));
    });
  }
}
