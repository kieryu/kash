import * as SecureStore from 'expo-secure-store';

import {
  clearFailures,
  FREE_TRIES,
  getLockState,
  lockEnabled,
  setBiometrics,
  setPin,
  setWipeAfter,
  shouldWipe,
  verifyPin,
  waitAfter,
  waitRemaining,
  WIPE_AFTER,
} from '../pin';

// Real scrypt, up to ~30 runs per test: slow on a busy machine.
jest.setTimeout(120_000);

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

let mockSeed = 0;
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + mockSeed) % 256)),
}));

const T0 = 1_800_000_000_000;

beforeEach(() => {
  mockStore.clear();
  mockSeed += 1;
});

async function missTimes(n: number, start = T0) {
  for (let i = 0; i < n; i++) await verifyPin('0000', start + i);
}

describe('PIN', () => {
  it('stores only a salted hash, device-only', async () => {
    await setPin('4821');
    const raw = mockStore.get('kash.lock.v1')!;
    expect(raw).not.toContain('4821');
    expect(JSON.parse(raw).pin).toEqual({
      salt: expect.stringMatching(/^[0-9a-f]{32}$/),
      hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      N: 16384,
      r: 8,
      p: 1,
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('kash.lock.v1', raw, {
      keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    });
  });

  it('same PIN, different salt → different hash', async () => {
    await setPin('4821');
    const a = (await getLockState()).pin!.hash;
    mockSeed += 1;
    await setPin('4821');
    expect((await getLockState()).pin!.hash).not.toBe(a);
  });

  it('accepts the right PIN and rejects others', async () => {
    await setPin('4821');
    expect(await verifyPin('4821', T0)).toEqual({ ok: true });
    expect(await verifyPin('4822', T0)).toEqual({ ok: false, waitMs: 0, triesLeft: FREE_TRIES - 1 });
    expect(await verifyPin('48210', T0)).toMatchObject({ ok: false });
  });

  it.each(['123', '12345', 'abcd', '12 4'])('refuses to set %p', async (pin) => {
    await expect(setPin(pin)).rejects.toThrow();
  });

  it('a right PIN resets the miss count', async () => {
    await setPin('4821');
    await missTimes(FREE_TRIES - 1);
    expect(await verifyPin('4821', T0 + 10)).toEqual({ ok: true });
    expect((await getLockState()).failed).toBe(0);
  });
});

describe('escalating waits', () => {
  it('grows after the free tries and caps at 1 hour', () => {
    expect([4, 5, 6, 7, 8, 9, 50].map(waitAfter)).toEqual([0, 30e3, 60e3, 300e3, 900e3, 3600e3, 3600e3]);
  });

  it('blocks tries during a wait without checking or counting them', async () => {
    await setPin('4821');
    await missTimes(FREE_TRIES);
    const t = T0 + FREE_TRIES - 1;
    expect(await verifyPin('4821', t + 1000)).toEqual({ ok: false, waitMs: 29_000, triesLeft: 0 });
    expect((await getLockState()).failed).toBe(FREE_TRIES);
    expect(await verifyPin('4821', t + 30_000)).toEqual({ ok: true });
  });

  it('a miss after the wait starts a longer wait', async () => {
    await setPin('4821');
    await missTimes(FREE_TRIES);
    expect(await verifyPin('0000', T0 + 60_000)).toEqual({ ok: false, waitMs: 60_000, triesLeft: 0 });
  });

  it('moving the clock back does not end a wait early', () => {
    const s = { pin: null, biometrics: false, failed: FREE_TRIES, lastFailAt: T0 };
    expect(waitRemaining(s, T0 - 10 * 60_000)).toBe(30_000);
  });

  it('a biometric unlock clears misses', async () => {
    await setPin('4821');
    await missTimes(FREE_TRIES);
    await clearFailures();
    expect(await verifyPin('4821', T0 + 1)).toEqual({ ok: true });
  });
});

describe('lockEnabled', () => {
  it('needs a PIN or biometrics', async () => {
    expect(lockEnabled(await getLockState())).toBe(false);
    await setBiometrics(true);
    expect(lockEnabled(await getLockState())).toBe(true);
    await setBiometrics(false);
    await setPin('1234');
    expect(lockEnabled(await getLockState())).toBe(true);
  });

  it('setting a PIN keeps the biometrics choice', async () => {
    await setBiometrics(true);
    await setPin('1234');
    expect((await getLockState()).biometrics).toBe(true);
  });
});

describe('erase after N wrong PINs', () => {
  it('is off by default: misses never ask for an erase', async () => {
    await setPin('4821');
    for (let i = 0; i < 30; i++) {
      const r = await verifyPin('0000', T0 + i * 2 * 60 * 60_000); // past every wait
      expect(r).not.toHaveProperty('wipe');
    }
  });

  it('asks for an erase on the Nth miss in a row, not before', async () => {
    await setPin('4821');
    await setWipeAfter(WIPE_AFTER);
    const hour = 2 * 60 * 60_000;
    for (let i = 1; i < WIPE_AFTER; i++) expect(await verifyPin('0000', T0 + i * hour)).not.toHaveProperty('wipe');
    expect(shouldWipe(await getLockState())).toBe(false);
    expect(await verifyPin('0000', T0 + WIPE_AFTER * hour)).toMatchObject({ ok: false, wipe: true });
    expect(shouldWipe(await getLockState())).toBe(true);
  });

  it('tries during a wait don’t count toward it', async () => {
    await setPin('4821');
    await setWipeAfter(FREE_TRIES + 1);
    await missTimes(FREE_TRIES); // now in a 30 s wait
    expect(await verifyPin('0000', T0 + 1_000)).not.toHaveProperty('wipe');
    expect((await getLockState()).failed).toBe(FREE_TRIES);
  });

  it('a right PIN resets the count; turning it off stops it', async () => {
    await setPin('4821');
    await setWipeAfter(2);
    await verifyPin('0000', T0);
    expect(await verifyPin('4821', T0 + 1)).toEqual({ ok: true });
    await setWipeAfter(null);
    await missTimes(2, T0 + 2);
    expect(shouldWipe(await getLockState())).toBe(false);
  });
});
