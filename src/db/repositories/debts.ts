import { asc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { debts, transactions, type Db, type DebtRow } from '../schema';

export type NewDebt = Omit<
  typeof debts.$inferInsert,
  'id' | 'sortOrder' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'paidOffOn'
>;
// Currency is fixed once transactions exist (home-currency relabel is its own operation).
export type DebtPatch = Partial<Omit<NewDebt, 'currency'>> & Pick<Partial<DebtRow>, 'archivedAt' | 'paidOffOn'>;

/** Inserts the debt and its opening-balance transaction together. Returns the new id. */
export function createDebt(db: Db, debt: NewDebt, opening: { balanceMinor: number; on: string }): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.transaction((tx) => {
    const { next } = tx
      .select({ next: sql<number>`coalesce(max(${debts.sortOrder}) + 1, 0)` })
      .from(debts)
      .get()!;
    tx.insert(debts).values({ ...debt, id, sortOrder: next, createdAt: now, updatedAt: now }).run();
    tx.insert(transactions)
      .values({
        id: randomUUID(),
        debtId: id,
        type: 'opening',
        amountMinor: opening.balanceMinor,
        currency: debt.currency,
        occurredOn: opening.on,
        isExtra: false,
        createdAt: now,
      })
      .run();
  });
  return id;
}

export function getDebt(db: Db, id: string): DebtRow | undefined {
  return db.select().from(debts).where(eq(debts.id, id)).get();
}

export function listDebts(db: Db, opts: { includeArchived?: boolean } = {}): DebtRow[] {
  return db
    .select()
    .from(debts)
    .where(opts.includeArchived ? undefined : isNull(debts.archivedAt))
    .orderBy(asc(debts.sortOrder))
    .all();
}

export function updateDebt(db: Db, id: string, patch: DebtPatch): void {
  db.update(debts)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(debts.id, id))
    .run();
}
