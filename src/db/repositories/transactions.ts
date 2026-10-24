import { desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { debts, transactions, type Db, type TransactionRow } from '../schema';

export type NewTransaction = {
  debtId: string;
  type: Exclude<TransactionRow['type'], 'opening' | 'reversal'>;
  amountMinor: number; // signed: + increases debt, − reduces (payments are negative)
  occurredOn: string;
  planMonth?: string;
  isExtra?: boolean;
  note?: string;
};

/** Appends a transaction in the debt's currency. Returns the new id. */
export function addTransaction(db: Db, t: NewTransaction): string {
  const debt = db.select({ currency: debts.currency }).from(debts).where(eq(debts.id, t.debtId)).get();
  if (!debt) throw new Error(`No debt ${t.debtId}`);
  const id = randomUUID();
  db.insert(transactions)
    .values({ ...t, id, isExtra: t.isExtra ?? false, currency: debt.currency, createdAt: new Date().toISOString() })
    .run();
  return id;
}

/** Undo = a new row with the opposite amount. The DB allows only one reversal per transaction. */
export function reverseTransaction(db: Db, id: string, occurredOn: string): string {
  const orig = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!orig) throw new Error(`No transaction ${id}`);
  if (orig.type === 'reversal') throw new Error('A reversal cannot be reversed');
  const newId = randomUUID();
  db.insert(transactions)
    .values({
      id: newId,
      debtId: orig.debtId,
      type: 'reversal',
      amountMinor: -orig.amountMinor,
      currency: orig.currency,
      occurredOn,
      planMonth: orig.planMonth,
      isExtra: orig.isExtra,
      reversesId: orig.id,
      createdAt: new Date().toISOString(),
    })
    .run();
  return newId;
}

export function listTransactions(db: Db, debtId: string): TransactionRow[] {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.debtId, debtId))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .all();
}

/** Balance per debt = sum of its transactions (D12). */
export function balances(db: Db): Map<string, number> {
  const rows = db
    .select({ debtId: transactions.debtId, balance: sql<number>`sum(${transactions.amountMinor})` })
    .from(transactions)
    .groupBy(transactions.debtId)
    .all();
  return new Map(rows.map((r) => [r.debtId, r.balance]));
}

export function balanceOf(db: Db, debtId: string): number {
  return db
    .select({ balance: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)` })
    .from(transactions)
    .where(eq(transactions.debtId, debtId))
    .get()!.balance;
}
