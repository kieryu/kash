import * as SQLite from 'expo-sqlite';

import { openEncryptedDb } from '@/db/client';
import { getOrCreateDbKey } from '@/security/keyManager';

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
  return steps;
}
