import { drizzle } from 'drizzle-orm/expo-sqlite/driver';
import * as SQLite from 'expo-sqlite';

import { getOrCreateDbKey, isValidDbKey } from '@/security/keyManager';

import { migrate } from './migrations';
import * as schema from './schema';

export const DB_NAME = 'kash.db';

export class EncryptionUnavailableError extends Error {
  constructor() {
    super('SQLCipher is not available in this build.');
    this.name = 'EncryptionUnavailableError';
  }
}

export class DbKeyMismatchError extends Error {
  constructor() {
    super('The database could not be opened with the stored key.');
    this.name = 'DbKeyMismatchError';
  }
}

type OpenOptions = { name?: string; useNewConnection?: boolean };

/**
 * Opens a SQLCipher-encrypted database. Refuses to continue if the build lacks SQLCipher,
 * so we can never silently write a plaintext database.
 */
export async function openEncryptedDb(key: string, opts: OpenOptions = {}): Promise<SQLite.SQLiteDatabase> {
  if (!isValidDbKey(key)) throw new DbKeyMismatchError();
  const db = await SQLite.openDatabaseAsync(opts.name ?? DB_NAME, { useNewConnection: opts.useNewConnection });
  try {
    const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
    if (!cipher?.cipher_version) throw new EncryptionUnavailableError();

    // Raw-key form: the key is already 256 random bits, so SQLCipher's password KDF is skipped.
    // Safe to interpolate: isValidDbKey guarantees exactly 64 hex characters.
    await db.execAsync(`PRAGMA key = "x'${key}'"`);

    try {
      await db.getFirstAsync('SELECT count(*) FROM sqlite_master');
    } catch {
      throw new DbKeyMismatchError();
    }

    await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    return db;
  } catch (e) {
    await db.closeAsync().catch(() => undefined);
    throw e;
  }
}

/** Opens the app database with the stored key, as Drizzle, with migrations applied. */
export async function openDb(opts: OpenOptions = {}) {
  const db = drizzle(await openEncryptedDb(await getOrCreateDbKey(), opts), { schema });
  migrate(db);
  return db;
}

let appDb: ReturnType<typeof openDb> | null = null;

/** The app's one shared connection, opened on first use. */
export function getAppDb(): ReturnType<typeof openDb> {
  appDb ??= openDb().catch((e) => {
    appDb = null; // let a later call retry
    throw e;
  });
  return appDb;
}
