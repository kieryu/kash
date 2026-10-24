import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// App lock config + PIN hash + failed-attempt counter. Kept in SecureStore, not the DB, so wiping or
// importing the DB can't reset the counter, and lock settings stay with this phone (DECISIONS.md D6).

const LOCK_KEY = 'kash.lock.v1';
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Params are stored with each hash so they can be raised later without breaking old PINs.
export const SCRYPT = { N: 2 ** 14, r: 8, p: 1 };
const PIN_PATTERN = /^\d{4}$/;

type PinHash = { salt: string; hash: string; N: number; r: number; p: number };

export type LockState = {
  pin: PinHash | null;
  biometrics: boolean;
  failed: number;
  lastFailAt: number | null; // ms epoch
  /** Erase all data after this many wrong PINs in a row; null = off (default). */
  wipeAfter?: number | null;
};

const EMPTY: LockState = { pin: null, biometrics: false, failed: 0, lastFailAt: null, wipeAfter: null };

export async function getLockState(): Promise<LockState> {
  const raw = await SecureStore.getItemAsync(LOCK_KEY, STORE_OPTIONS);
  return raw === null ? EMPTY : { ...EMPTY, ...JSON.parse(raw) };
}

async function save(state: LockState): Promise<void> {
  await SecureStore.setItemAsync(LOCK_KEY, JSON.stringify(state), STORE_OPTIONS);
}

/** True when the app should lock: a PIN or biometric unlock has been set up. */
export function lockEnabled(s: LockState): boolean {
  return s.pin !== null || s.biometrics;
}

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

async function hashPin(pin: string, salt: Uint8Array, params: Omit<PinHash, 'salt' | 'hash'>): Promise<Uint8Array> {
  return scryptAsync(pin, salt, { ...params, dkLen: 32 });
}

export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 digits.');
  const salt = await getRandomBytesAsync(16);
  const hash = await hashPin(pin, salt, SCRYPT);
  const state = await getLockState();
  await save({ ...state, pin: { salt: bytesToHex(salt), hash: bytesToHex(hash), ...SCRYPT }, failed: 0, lastFailAt: null });
}

export async function setBiometrics(on: boolean): Promise<void> {
  await save({ ...(await getLockState()), biometrics: on });
}

/** After a successful biometric / passcode unlock the owner is proven, so PIN misses start over. */
export async function clearFailures(): Promise<void> {
  const state = await getLockState();
  if (state.failed > 0) await save({ ...state, failed: 0, lastFailAt: null });
}

/** The one choice offered in Settings for "erase after N wrong PINs". */
export const WIPE_AFTER = 10;

export async function setWipeAfter(n: number | null): Promise<void> {
  await save({ ...(await getLockState()), wipeAfter: n });
}

/** True once the wrong-PIN count reaches the erase setting. */
export function shouldWipe(s: LockState): boolean {
  return s.pin !== null && s.wipeAfter != null && s.failed >= s.wipeAfter;
}

/** Only for "Delete all data". */
export async function clearLockState(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCK_KEY, STORE_OPTIONS);
}

// Free tries, then waits that grow with each further miss.
export const FREE_TRIES = 5;
const WAITS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

/** Wait required after `failed` misses in a row. */
export function waitAfter(failed: number): number {
  if (failed < FREE_TRIES) return 0;
  return WAITS_MS[Math.min(failed - FREE_TRIES, WAITS_MS.length - 1)];
}

/** Ms left before another try is allowed (0 = may try now). */
export function waitRemaining(s: LockState, now: number): number {
  if (s.lastFailAt === null) return 0;
  // ponytail: wall clock, so moving the clock forward skips a wait. A monotonic clock needs a native module.
  // Clock moved back: restart the wait from now instead of letting a negative elapsed time count as waited.
  const elapsed = Math.max(0, now - s.lastFailAt);
  return Math.max(0, waitAfter(s.failed) - elapsed);
}

/** `wipe`: this miss reached the erase setting; the caller erases all data. */
export type VerifyResult = { ok: true } | { ok: false; waitMs: number; triesLeft: number; wipe?: true };

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Checks the PIN. While a wait is running the PIN isn't checked and the try doesn't count. */
export async function verifyPin(pin: string, now = Date.now()): Promise<VerifyResult> {
  const state = await getLockState();
  if (!state.pin) throw new Error('No PIN set.');

  const wait = waitRemaining(state, now);
  if (wait > 0) return { ok: false, waitMs: wait, triesLeft: 0 };

  const { salt, hash, ...params } = state.pin;
  if (isValidPin(pin) && sameBytes(await hashPin(pin, hexToBytes(salt), params), hexToBytes(hash))) {
    if (state.failed > 0) await save({ ...state, failed: 0, lastFailAt: null });
    return { ok: true };
  }

  const next = { ...state, failed: state.failed + 1, lastFailAt: now };
  await save(next);
  const r = { ok: false as const, waitMs: waitAfter(next.failed), triesLeft: Math.max(0, FREE_TRIES - next.failed) };
  return shouldWipe(next) ? { ...r, wipe: true } : r;
}
