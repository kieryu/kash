import { eq } from 'drizzle-orm';

import { debts, entitlement, settings, transactions, type Db, type Entitlement, type Settings } from '../schema';

// Both tables hold exactly one row (id = 1), seeded by the first migration.

export function getSettings(db: Db): Settings {
  return db.select().from(settings).get()!;
}

export function updateSettings(db: Db, patch: Partial<Omit<Settings, 'id'>>): void {
  db.update(settings).set(patch).run();
}

export function getEntitlement(db: Db): Entitlement {
  return db.select().from(entitlement).get()!;
}

export function setEntitlement(db: Db, e: Omit<Entitlement, 'id'>): void {
  db.update(entitlement).set(e).run();
}

/** Renames the currency code on the home currency, its debts and transactions. Amounts are untouched. */
export function relabelCurrency(db: Db, from: string, to: string): void {
  db.transaction((tx) => {
    tx.update(debts).set({ currency: to }).where(eq(debts.currency, from)).run();
    tx.update(transactions).set({ currency: to }).where(eq(transactions.currency, from)).run();
    tx.update(settings).set({ homeCurrency: to }).run();
  });
}
