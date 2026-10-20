import * as SecureStore from 'expo-secure-store';

import { deleteDbKey, getOrCreateDbKey, InvalidDbKeyError, isValidDbKey } from '../keyManager';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

let mockCounter = 0;
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (n: number) => Uint8Array.from({ length: n }, (_, i) => (i + mockCounter) % 256)),
}));

beforeEach(() => {
  mockStore.clear();
  mockCounter += 1;
  jest.clearAllMocks();
});

describe('getOrCreateDbKey', () => {
  it('creates a 256-bit hex key on first call and stores it device-only', async () => {
    const key = await getOrCreateDbKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), key, {
      keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    });
  });

  it('returns the same key on later calls without regenerating', async () => {
    const first = await getOrCreateDbKey();
    mockCounter += 1;
    expect(await getOrCreateDbKey()).toBe(first);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('gives concurrent callers the same key', async () => {
    const [a, b] = await Promise.all([getOrCreateDbKey(), getOrCreateDbKey()]);
    expect(a).toBe(b);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('refuses a malformed stored key instead of overwriting it', async () => {
    mockStore.set('kash.db.key.v1', 'not-a-key');
    await expect(getOrCreateDbKey()).rejects.toBeInstanceOf(InvalidDbKeyError);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('creates a fresh key after deletion', async () => {
    const first = await getOrCreateDbKey();
    await deleteDbKey();
    mockCounter += 1;
    expect(await getOrCreateDbKey()).not.toBe(first);
  });
});

describe('isValidDbKey', () => {
  it.each([
    ['a'.repeat(64), true],
    ['A'.repeat(64), false],
    ['a'.repeat(63), false],
    ["a'; DROP TABLE x; --", false],
  ])('%s → %s', (key, ok) => expect(isValidDbKey(key)).toBe(ok));
});
