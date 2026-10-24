import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sql } from 'drizzle-orm';
import { getRandomBytesAsync } from 'expo-crypto';

import { SCHEMA_VERSION } from '@/db/migrations';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { debts, statementCheckins, transactions, type Db, type Settings } from '@/db/schema';

// Encrypted export file (CLAUDE.md §9): a JSON envelope around AES-256-GCM ciphertext,
// key = scrypt(password, salt). Params travel with the file so they can be raised later.

const FORMAT = 'kash-backup';
const ENVELOPE_VERSION = 1;
export const SCRYPT = { N: 2 ** 15, r: 8, p: 1 };
export const MIN_PASSWORD_LENGTH = 8;

// Device-specific: an import must not change this phone's lock settings (D19) or backup reminder.
const DEVICE_SETTINGS = ['id', 'lockTimeoutSec', 'blockScreenshots', 'lastBackupAt'] as const;
type PortableSettings = Omit<Settings, (typeof DEVICE_SETTINGS)[number]>;

export type BackupData = {
  schemaVersion: number;
  exportedAt: string;
  debts: (typeof debts.$inferSelect)[];
  transactions: (typeof transactions.$inferSelect)[];
  statementCheckins: (typeof statementCheckins.$inferSelect)[];
  settings: PortableSettings;
};

type Envelope = {
  format: typeof FORMAT;
  v: number;
  kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string };
  nonce: string;
  // ponytail: hex doubles the size; switch to base64 if files get big (thousands of transactions are still < a few MB).
  data: string;
};

export class NotABackupError extends Error {
  constructor() {
    super('This file is not a Kash backup.');
    this.name = 'NotABackupError';
  }
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong password, or the file is damaged.');
    this.name = 'WrongPasswordError';
  }
}

export class BackupTooNewError extends Error {
  constructor(found: number) {
    super(`This backup (v${found}) is from a newer version of the app. Update the app, then import again.`);
    this.name = 'BackupTooNewError';
  }
}

// Upgrades backup data from schema v(i+1) to v(i+2). A test makes each new DB migration add one here.
export const UPGRADES: ((d: BackupData) => BackupData)[] = [
  (d) => d, // v2 only changed a trigger
];

function deriveKey(password: string, salt: Uint8Array, p: typeof SCRYPT): Promise<Uint8Array> {
  // NFKC so the same password typed on another keyboard gives the same key.
  return scryptAsync(password.normalize('NFKC'), salt, { ...p, dkLen: 32 });
}

/** Reads everything into a backup object (plaintext — encrypt before it leaves the app). */
export function collectBackup(db: Db): BackupData {
  const s: Partial<Settings> = { ...getSettings(db) };
  for (const k of DEVICE_SETTINGS) delete s[k];
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    debts: db.select().from(debts).all(),
    transactions: db.select().from(transactions).all(),
    statementCheckins: db.select().from(statementCheckins).all(),
    settings: s as PortableSettings,
  };
}

/** Builds the encrypted file contents. */
export async function exportBackup(db: Db, password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  const salt = await getRandomBytesAsync(16);
  const nonce = await getRandomBytesAsync(12);
  const key = await deriveKey(password, salt, SCRYPT);
  const data = gcm(key, nonce).encrypt(utf8ToBytes(JSON.stringify(collectBackup(db))));
  const envelope: Envelope = {
    format: FORMAT,
    v: ENVELOPE_VERSION,
    kdf: { name: 'scrypt', ...SCRYPT, salt: bytesToHex(salt) },
    nonce: bytesToHex(nonce),
    data: bytesToHex(data),
  };
  return JSON.stringify(envelope);
}

/** Decrypts a file and upgrades its data to this app's schema. Nothing is written. */
export async function readBackup(file: string, password: string): Promise<BackupData> {
  let env: Envelope;
  try {
    env = JSON.parse(file);
  } catch {
    throw new NotABackupError();
  }
  if (env?.format !== FORMAT || env.kdf?.name !== 'scrypt') throw new NotABackupError();
  if (env.v > ENVELOPE_VERSION) throw new BackupTooNewError(env.v);
  // The file is untrusted: cap scrypt cost so a crafted file can't freeze or crash the phone.
  const { N, r, p, salt } = env.kdf;
  if (!(Number.isInteger(N) && N >= 2 && N <= 2 ** 17 && r === 8 && p === 1)) throw new NotABackupError();

  let plain: string;
  try {
    const key = await deriveKey(password, hexToBytes(salt), { N, r, p });
    plain = bytesToUtf8(gcm(key, hexToBytes(env.nonce)).decrypt(hexToBytes(env.data)));
  } catch {
    throw new WrongPasswordError();
  }

  let data = JSON.parse(plain) as BackupData;
  if (!Number.isInteger(data?.schemaVersion) || data.schemaVersion < 1) throw new NotABackupError();
  if (data.schemaVersion > SCHEMA_VERSION) throw new BackupTooNewError(data.schemaVersion);
  for (let v = data.schemaVersion; v < SCHEMA_VERSION; v++) data = { ...UPGRADES[v - 1](data), schemaVersion: v + 1 };
  if (![data.debts, data.transactions, data.statementCheckins].every(Array.isArray) || !data.settings) {
    throw new NotABackupError();
  }
  return data;
}

/**
 * Replace all (CLAUDE.md §9): deletes every debt, transaction and check-in, then writes the backup's.
 * One DB transaction: if any row breaks a DB rule, nothing changes. Entitlement is never imported
 * (Pro is re-checked with Play); device settings stay as they are.
 */
export function replaceAll(db: Db, data: BackupData): void {
  db.transaction((tx) => {
    // Rows reference each other (reversals, check-ins); check foreign keys at commit, not per insert.
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    tx.delete(statementCheckins).run();
    tx.delete(transactions).run();
    tx.delete(debts).run();
    // One row per insert keeps clear of SQLite's bound-parameter limit.
    for (const r of data.debts) tx.insert(debts).values(r).run();
    for (const r of data.transactions) tx.insert(transactions).values(r).run();
    for (const r of data.statementCheckins) tx.insert(statementCheckins).values(r).run();
    const s: Partial<Settings> = { ...data.settings };
    for (const k of DEVICE_SETTINGS) delete s[k];
    updateSettings(tx, s);
  });
}
