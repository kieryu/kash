import { testDb } from '@/db/__tests__/testDb';
import { getEntitlement, setEntitlement } from '@/db/repositories/settings';

import { buyPro, restorePro, syncPro, type Store } from '../billing';

const fail = () => Promise.reject(new Error('Play unreachable'));

function store(over: Partial<Store>): Store {
  return { price: async () => '₱99.00', buy: fail, owned: fail, ...over };
}

describe('buyPro', () => {
  test('a completed purchase unlocks Pro from Play', async () => {
    const db = testDb();
    expect(await buyPro(db, store({ buy: async () => 'bought' }))).toBe('unlocked');
    expect(getEntitlement(db)).toMatchObject({ isPro: true, source: 'play' });
  });

  test.each(['pending', 'cancelled', 'failed'] as const)('%s leaves Pro locked', async (r) => {
    const db = testDb();
    expect(await buyPro(db, store({ buy: async () => r }))).toBe(r);
    expect(getEntitlement(db).isPro).toBe(false);
  });

  test('Play unreachable → unavailable, nothing changes', async () => {
    const db = testDb();
    expect(await buyPro(db, store({}))).toBe('unavailable');
    expect(getEntitlement(db).isPro).toBe(false);
  });

  test('already owned → restores instead of buying again', async () => {
    const db = testDb();
    const s = store({ buy: async () => 'owned', owned: async () => 'owned' });
    expect(await buyPro(db, s)).toBe('unlocked');
    expect(getEntitlement(db).isPro).toBe(true);
  });
});

describe('restorePro', () => {
  test.each([
    ['owned', 'unlocked', true],
    ['pending', 'pending', false],
    ['none', 'not_found', false],
  ] as const)('Play says %s → %s', async (owned, result, isPro) => {
    const db = testDb();
    expect(await restorePro(db, store({ owned: async () => owned }))).toBe(result);
    expect(getEntitlement(db).isPro).toBe(isPro);
  });

  test('Play unreachable → unavailable', async () => {
    expect(await restorePro(testDb(), store({}))).toBe('unavailable');
  });
});

describe('syncPro (on launch)', () => {
  test('grants a purchase that cleared while the app was closed', async () => {
    const db = testDb();
    await syncPro(db, store({ owned: async () => 'owned' }));
    expect(getEntitlement(db)).toMatchObject({ isPro: true, source: 'play' });
  });

  test('removes Pro after a refund', async () => {
    const db = testDb();
    setEntitlement(db, { isPro: true, source: 'play', checkedAt: null });
    await syncPro(db, store({ owned: async () => 'none' }));
    expect(getEntitlement(db)).toMatchObject({ isPro: false, source: null });
  });

  test('offline keeps Pro', async () => {
    const db = testDb();
    setEntitlement(db, { isPro: true, source: 'play', checkedAt: null });
    await syncPro(db, store({}));
    expect(getEntitlement(db).isPro).toBe(true);
  });

  test('pending keeps the current state', async () => {
    const db = testDb();
    setEntitlement(db, { isPro: true, source: 'play', checkedAt: null });
    await syncPro(db, store({ owned: async () => 'pending' }));
    expect(getEntitlement(db).isPro).toBe(true);
  });

  test('clears Pro left over from the removed tester switch', async () => {
    const db = testDb();
    setEntitlement(db, { isPro: true, source: 'test', checkedAt: null });
    await syncPro(db, store({ owned: async () => 'none' }));
    expect(getEntitlement(db).isPro).toBe(false);
  });
});

// expo-iap also ships helpers that send purchase data to servers (IAPKit, Google API, Meta). Keep them out (D43).
declare const require: (m: string) => unknown;
declare const __dirname: string;

test('no expo-iap server verification calls in app code', () => {
  // Required, not imported: the app's tsconfig has no Node types (same trick as networkGuard.test.ts).
  type Fs = {
    readdirSync(p: string): string[];
    readFileSync(p: string, enc: 'utf8'): string;
    statSync(p: string): { isDirectory(): boolean };
  };
  const { readdirSync, readFileSync, statSync } = require('node:fs') as Fs;
  const { join } = require('node:path') as { join(...p: string[]): string };
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) {
        if (f !== '__tests__') walk(p);
      } else if (/\.tsx?$/.test(f)) files.push(p);
    }
  };
  walk(join(__dirname, '../..'));
  const bad = files.filter((f) =>
    /\b(kitApi|verifyPurchase|verifyPurchaseWithProvider|verifyAppOwnership|useIAP)\s*[(.]/.test(readFileSync(f, 'utf8')),
  );
  expect(bad).toEqual([]);
});
