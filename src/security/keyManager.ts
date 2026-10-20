import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// The SQLCipher key: 32 random bytes, generated once, kept only in the Keychain / Keystore
// (DECISIONS.md D5). Never log, export or display it.

const DB_KEY_NAME = 'kash.db.key.v1';
const KEY_BYTES = 32;
const KEY_PATTERN = /^[0-9a-f]{64}$/;

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  // Never migrates to another device or into a backup.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class InvalidDbKeyError extends Error {
  constructor() {
    super('Stored database key has an unexpected format.');
    this.name = 'InvalidDbKeyError';
  }
}

export function isValidDbKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

let pending: Promise<string> | null = null;

/** Returns the DB key, creating and storing it on first launch. Concurrent callers share one key. */
export function getOrCreateDbKey(): Promise<string> {
  pending ??= loadOrCreate().finally(() => {
    pending = null;
  });
  return pending;
}

async function loadOrCreate(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DB_KEY_NAME, STORE_OPTIONS);
  if (existing !== null) {
    if (!isValidDbKey(existing)) throw new InvalidDbKeyError();
    return existing;
  }
  const key = toHex(await getRandomBytesAsync(KEY_BYTES));
  await SecureStore.setItemAsync(DB_KEY_NAME, key, STORE_OPTIONS);
  return key;
}

/** Only for "Delete all data". The encrypted DB becomes unreadable once this is gone. */
export async function deleteDbKey(): Promise<void> {
  await SecureStore.deleteItemAsync(DB_KEY_NAME, STORE_OPTIONS);
}
