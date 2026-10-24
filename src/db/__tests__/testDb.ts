import { drizzle } from 'drizzle-orm/expo-sqlite/driver';
import { DatabaseSync } from 'node:sqlite';

import { migrate } from '../migrations';
import * as schema from '../schema';

// The real Drizzle expo-sqlite driver over Node's built-in SQLite, via the few sync methods it calls.
export function rawTestDb(): DatabaseSync {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  return raw;
}

export function drizzleOver(raw: DatabaseSync): schema.Db {
  const client = {
    prepareSync(query: string) {
      const stmt = raw.prepare(query);
      const exec = (arrays: boolean, params: never[]) => {
        stmt.setReturnArrays(arrays);
        const rows = stmt.all(...params);
        return { changes: 0, lastInsertRowId: 0, getAllSync: () => rows, getFirstSync: () => rows[0] ?? null };
      };
      return {
        executeSync: (p: never[]) => exec(false, p),
        executeForRawResultSync: (p: never[]) => exec(true, p),
      };
    },
  };
  return drizzle(client as never, { schema });
}

export function testDb(): schema.Db {
  const db = drizzleOver(rawTestDb());
  migrate(db);
  return db;
}
