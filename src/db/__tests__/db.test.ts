import { getTableConfig } from 'drizzle-orm/sqlite-core';

import { DbTooNewError, migrate, SCHEMA_VERSION } from '../migrations';
import { recordCheckIn } from '../repositories/checkins';
import { createDebt, getDebt, listDebts, updateDebt, type NewDebt } from '../repositories/debts';
import { getEntitlement, getSettings, setEntitlement, updateSettings } from '../repositories/settings';
import {
  addTransaction,
  balanceOf,
  balances,
  listTransactions,
  reverseTransaction,
} from '../repositories/transactions';
import * as schema from '../schema';
import { drizzleOver, rawTestDb, testDb } from './testDb';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const card: NewDebt = {
  nickname: 'Everyday Card',
  kind: 'credit_card',
  color: '#1C3D73',
  currency: 'PHP',
  monthlyRate: '0.03',
  rateEnteredAs: 'monthly',
  minRule: 'percent_or_fixed',
  minPercent: '0.03',
  minFixedMinor: 50_000,
  acceptsExtra: true,
  autoDeducted: false,
};

const installment: NewDebt = {
  ...card,
  nickname: 'Phone',
  kind: 'card_installment',
  monthlyRate: '0',
  minRule: null,
  minPercent: null,
  minFixedMinor: null,
  amortizationMinor: 250_000,
  interestMethod: 'baked_in',
  acceptsExtra: false,
};

describe('migrations', () => {
  it('creates every Drizzle table with matching columns', () => {
    const raw = rawTestDb();
    migrate(drizzleOver(raw));
    for (const table of [
      schema.debts,
      schema.transactions,
      schema.statementCheckins,
      schema.settings,
      schema.entitlement,
    ]) {
      const { name, columns } = getTableConfig(table);
      const actual = raw.prepare(`PRAGMA table_info(${name})`).all() as { name: string; notnull: number; pk: number }[];
      expect(actual.map((c) => [c.name, c.notnull === 1 || c.pk === 1]).sort()).toEqual(
        columns.map((c) => [c.name, c.notNull]).sort(),
      );
    }
  });

  it('is idempotent and records the version', () => {
    const raw = rawTestDb();
    const db = drizzleOver(raw);
    migrate(db);
    migrate(db);
    expect(raw.prepare('PRAGMA user_version').get()).toEqual({ user_version: SCHEMA_VERSION });
  });

  it('refuses a database from a newer app', () => {
    const raw = rawTestDb();
    raw.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    expect(() => migrate(drizzleOver(raw))).toThrow(DbTooNewError);
  });

  it('seeds settings and entitlement', () => {
    const db = testDb();
    expect(getSettings(db)).toMatchObject({ homeCurrency: 'PHP', strategy: 'snowball', lockTimeoutSec: 60 });
    expect(getEntitlement(db).isPro).toBe(false);
    updateSettings(db, { budgetMinor: 1_500_000, hideBalances: true });
    setEntitlement(db, { isPro: true, source: 'test', checkedAt: null });
    expect(getSettings(db)).toMatchObject({ budgetMinor: 1_500_000, hideBalances: true });
    expect(getEntitlement(db)).toMatchObject({ isPro: true, source: 'test' });
  });
});

describe('debts', () => {
  it('creates a debt with its opening balance and keeps insertion order', () => {
    const db = testDb();
    const a = createDebt(db, card, { balanceMinor: 1_845_000, on: '2026-10-24' });
    const b = createDebt(db, installment, { balanceMinor: 1_500_000, on: '2026-10-24' });
    expect(listDebts(db).map((d) => [d.id, d.sortOrder])).toEqual([
      [a, 0],
      [b, 1],
    ]);
    expect(balanceOf(db, a)).toBe(1_845_000);
    expect(listTransactions(db, a)).toMatchObject([{ type: 'opening', amountMinor: 1_845_000, currency: 'PHP' }]);
  });

  it('hides archived debts unless asked', () => {
    const db = testDb();
    const id = createDebt(db, card, { balanceMinor: 100, on: '2026-10-24' });
    updateDebt(db, id, { archivedAt: '2026-10-25T00:00:00.000Z', nickname: 'Old card' });
    expect(listDebts(db)).toEqual([]);
    expect(listDebts(db, { includeArchived: true })).toHaveLength(1);
    expect(getDebt(db, id)?.nickname).toBe('Old card');
  });

  it('rejects a debt that is both revolving and installment, or neither', () => {
    const db = testDb();
    const on = { balanceMinor: 0, on: '2026-10-24' };
    expect(() => createDebt(db, { ...card, amortizationMinor: 1, interestMethod: 'baked_in' }, on)).toThrow();
    expect(() => createDebt(db, { ...card, minRule: null }, on)).toThrow();
    expect(listDebts(db)).toEqual([]); // nothing half-written
  });

  it('rejects fractional money', () => {
    const db = testDb();
    expect(() => createDebt(db, card, { balanceMinor: 10.5, on: '2026-10-24' })).toThrow();
    expect(listDebts(db)).toEqual([]);
  });
});

describe('transactions', () => {
  it('derives balances from the sum of transactions', () => {
    const db = testDb();
    const a = createDebt(db, card, { balanceMinor: 1_000_000, on: '2026-10-01' });
    const b = createDebt(db, card, { balanceMinor: 50_000, on: '2026-10-01' });
    addTransaction(db, { debtId: a, type: 'payment', amountMinor: -200_000, occurredOn: '2026-10-05' });
    addTransaction(db, { debtId: a, type: 'charge', amountMinor: 30_000, occurredOn: '2026-10-06' });
    addTransaction(db, { debtId: b, type: 'payment', amountMinor: -50_000, occurredOn: '2026-10-05' });
    expect(balances(db)).toEqual(
      new Map([
        [a, 830_000],
        [b, 0],
      ]),
    );
  });

  it('enforces signs per type', () => {
    const db = testDb();
    const a = createDebt(db, card, { balanceMinor: 1_000, on: '2026-10-01' });
    expect(() => addTransaction(db, { debtId: a, type: 'payment', amountMinor: 100, occurredOn: '2026-10-02' })).toThrow();
    expect(() => addTransaction(db, { debtId: a, type: 'charge', amountMinor: -100, occurredOn: '2026-10-02' })).toThrow();
    expect(balanceOf(db, a)).toBe(1_000);
  });

  it('is append-only and undoes with one reversal', () => {
    const db = testDb();
    const a = createDebt(db, card, { balanceMinor: 1_000, on: '2026-10-01' });
    const pay = addTransaction(db, { debtId: a, type: 'payment', amountMinor: -400, occurredOn: '2026-10-02' });
    expect(() => db.update(schema.transactions).set({ amountMinor: -1 }).run()).toThrow(/append-only/);

    const rev = reverseTransaction(db, pay, '2026-10-03');
    expect(balanceOf(db, a)).toBe(1_000);
    expect(() => reverseTransaction(db, pay, '2026-10-03')).toThrow(); // already reversed
    expect(() => reverseTransaction(db, rev, '2026-10-03')).toThrow();
    expect(listTransactions(db, a).map((t) => t.type)).toEqual(['reversal', 'payment', 'opening']);
  });

  it('refuses unknown debts', () => {
    expect(() =>
      addTransaction(testDb(), { debtId: 'nope', type: 'charge', amountMinor: 1, occurredOn: '2026-10-02' }),
    ).toThrow();
  });
});

describe('statement check-in', () => {
  it('saves the difference as interest, purchases or an unlogged payment', () => {
    const db = testDb();
    const a = createDebt(db, card, { balanceMinor: 3_637_000, on: '2026-10-01' });

    expect(recordCheckIn(db, { debtId: a, statementDate: '2026-11-03', statementMinor: 3_763_900, reason: 'interest_fees' })).toEqual({
      expectedMinor: 3_637_000,
      differenceMinor: 126_900,
    });
    expect(listTransactions(db, a)[0]).toMatchObject({ type: 'interest_fee', amountMinor: 126_900 });

    recordCheckIn(db, { debtId: a, statementDate: '2026-12-03', statementMinor: 3_000_000, reason: 'unlogged_payment' });
    expect(listTransactions(db, a)[0]).toMatchObject({ type: 'payment', amountMinor: -763_900 });
    expect(balanceOf(db, a)).toBe(3_000_000);
  });

  it('records a matching statement without a transaction', () => {
    const db = testDb();
    const a = createDebt(db, card, { balanceMinor: 5_000, on: '2026-10-01' });
    expect(recordCheckIn(db, { debtId: a, statementDate: '2026-11-03', statementMinor: 5_000 }).differenceMinor).toBe(0);
    expect(listTransactions(db, a)).toHaveLength(1);
  });

  it('rejects a missing or mismatched reason, leaving nothing behind', () => {
    const db = testDb();
    const a = createDebt(db, card, { balanceMinor: 5_000, on: '2026-10-01' });
    expect(() => recordCheckIn(db, { debtId: a, statementDate: '2026-11-03', statementMinor: 6_000 })).toThrow();
    expect(() =>
      recordCheckIn(db, { debtId: a, statementDate: '2026-11-03', statementMinor: 6_000, reason: 'unlogged_payment' }),
    ).toThrow();
    expect(balanceOf(db, a)).toBe(5_000);
    expect(db.select().from(schema.statementCheckins).all()).toEqual([]);
  });
});
