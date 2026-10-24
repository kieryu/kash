import { scryptAsync } from '@noble/hashes/scrypt.js';
import * as SQLite from 'expo-sqlite';

import { openDb, openEncryptedDb } from '@/db/client';
import { createDebt } from '@/db/repositories/debts';
import { balanceOf } from '@/db/repositories/transactions';
import { getOrCreateDbKey } from '@/security/keyManager';
import { SCRYPT } from '@/security/pin';

// Development-only check that SQLCipher works on a real device. Uses a throwaway database file.

const CHECK_DB = 'kash-selfcheck.db';
const WRONG_KEY = '0'.repeat(64);

export type CheckStep = { name: string; ok: boolean; detail?: string };

async function step(steps: CheckStep[], name: string, fn: () => Promise<string | void>): Promise<void> {
  try {
    const detail = await fn();
    steps.push({ name, ok: true, detail: detail ?? undefined });
  } catch (e) {
    steps.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}

async function expectUnreadable(open: () => Promise<SQLite.SQLiteDatabase>): Promise<string> {
  let db: SQLite.SQLiteDatabase | null = null;
  try {
    db = await open();
    await db.getFirstAsync('SELECT count(*) FROM sqlite_master');
  } catch (e) {
    return `refused as expected (${e instanceof Error ? e.name : 'error'})`;
  } finally {
    await db?.closeAsync().catch(() => undefined);
  }
  throw new Error('Database was readable — it is NOT encrypted');
}

export async function runDbSelfCheck(): Promise<CheckStep[]> {
  const steps: CheckStep[] = [];
  await SQLite.deleteDatabaseAsync(CHECK_DB).catch(() => undefined);

  const key = await getOrCreateDbKey();

  await step(steps, 'Open with stored key, write and read back', async () => {
    const db = await openEncryptedDb(key, { name: CHECK_DB, useNewConnection: true });
    try {
      const v = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
      await db.execAsync('CREATE TABLE t (id INTEGER PRIMARY KEY, amount_minor INTEGER NOT NULL)');
      await db.runAsync('INSERT INTO t (amount_minor) VALUES (?)', 1845000);
      const row = await db.getFirstAsync<{ amount_minor: number }>('SELECT amount_minor FROM t');
      if (row?.amount_minor !== 1845000) throw new Error('read-back mismatch');
      return `SQLCipher ${v?.cipher_version}`;
    } finally {
      await db.closeAsync();
    }
  });

  await step(steps, 'Open without a key', () =>
    expectUnreadable(() => SQLite.openDatabaseAsync(CHECK_DB, { useNewConnection: true })),
  );

  await step(steps, 'Open with the wrong key', () =>
    expectUnreadable(() => openEncryptedDb(WRONG_KEY, { name: CHECK_DB, useNewConnection: true })),
  );

  await step(steps, 'Same key on second call', async () => {
    if ((await getOrCreateDbKey()) !== key) throw new Error('key changed between calls');
  });

  await SQLite.deleteDatabaseAsync(CHECK_DB).catch(() => undefined);

  await step(steps, 'Migrations + repositories through Drizzle', async () => {
    const db = await openDb({ name: CHECK_DB, useNewConnection: true });
    try {
      const id = createDebt(
        db,
        {
          nickname: 'Self-check',
          kind: 'credit_card',
          color: 'gray',
          currency: 'PHP',
          monthlyRate: '0.03',
          rateEnteredAs: 'monthly',
          minRule: 'fixed',
          minFixedMinor: 50000,
          acceptsExtra: true,
          autoDeducted: false,
        },
        { balanceMinor: 1845000, on: '2026-10-24' },
      );
      if (balanceOf(db, id) !== 1845000) throw new Error('balance mismatch');
    } finally {
      await db.$client.closeAsync();
    }
  });

  await SQLite.deleteDatabaseAsync(CHECK_DB).catch(() => undefined);

  // DECISIONS.md D13: over ~500 ms on a mid-range phone → switch to react-native-quick-crypto.
  await step(steps, 'PIN hash speed (scrypt, target ≤ 500 ms)', async () => {
    const t = Date.now();
    await scryptAsync('0000', 'salt-for-timing', { ...SCRYPT, dkLen: 32 });
    const ms = Date.now() - t;
    if (ms > 500) throw new Error(`${ms} ms — too slow`);
    return `${ms} ms`;
  });

  return steps;
}
