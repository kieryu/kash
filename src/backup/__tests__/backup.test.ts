import { recordCheckIn } from '@/db/repositories/checkins';
import { createDebt, listDebts, type NewDebt } from '@/db/repositories/debts';
import { getEntitlement, getSettings, setEntitlement, updateSettings } from '@/db/repositories/settings';
import { addTransaction, balances, listTransactions, reverseTransaction } from '@/db/repositories/transactions';
import { SCHEMA_VERSION } from '@/db/migrations';
import { testDb } from '@/db/__tests__/testDb';

import {
  BackupTooNewError,
  collectBackup,
  exportBackup,
  NotABackupError,
  readBackup,
  replaceAll,
  UPGRADES,
  WrongPasswordError,
} from '../backup';

// Real scrypt runs: slow on a busy machine, so allow more than Jest's 5 s.
jest.setTimeout(30_000);

jest.mock('expo-crypto', () => {
  const c = jest.requireActual('node:crypto');
  return { randomUUID: () => c.randomUUID(), getRandomBytesAsync: async (n: number) => new Uint8Array(c.randomBytes(n)) };
});

const card: NewDebt = {
  nickname: 'Everyday Card',
  kind: 'credit_card',
  color: '#1C3D73',
  currency: 'PHP',
  monthlyRate: '0.03',
  rateEnteredAs: 'monthly',
  minRule: 'percent_or_fixed',
  minPercent: '0.03',
  minFixedMinor: 50_000,
  acceptsExtra: true,
  autoDeducted: false,
};

const PASSWORD = 'correct horse';

/** A phone with a debt, a payment, its undo, and a statement check-in. */
function filledDb() {
  const db = testDb();
  const id = createDebt(db, card, { balanceMinor: 1_000_000, on: '2026-10-01' });
  const pay = addTransaction(db, { debtId: id, type: 'payment', amountMinor: -50_000, occurredOn: '2026-10-05' });
  reverseTransaction(db, pay, '2026-10-06');
  recordCheckIn(db, { debtId: id, statementDate: '2026-10-20', statementMinor: 1_030_000, reason: 'interest_fees' });
  updateSettings(db, { strategy: 'avalanche', budgetMinor: 300_000, lockTimeoutSec: 0, blockScreenshots: true });
  return db;
}

describe('export → import', () => {
  it('round-trips every debt, transaction and check-in into another phone', async () => {
    const from = filledDb();
    const file = await exportBackup(from, PASSWORD);

    const to = testDb();
    createDebt(to, { ...card, nickname: 'Old phone debt' }, { balanceMinor: 5, on: '2026-01-01' });
    updateSettings(to, { lockTimeoutSec: 900 });
    replaceAll(to, await readBackup(file, PASSWORD));

    const { exportedAt: _a, ...expected } = collectBackup(from);
    const { exportedAt: _b, ...actual } = collectBackup(to);
    expect(actual).toEqual(expected);
    expect(balances(to)).toEqual(balances(from));
    expect(listDebts(to).map((d) => d.nickname)).toEqual(['Everyday Card']);
  });

  it("keeps this phone's lock settings, backup date and Pro status", async () => {
    const file = await exportBackup(filledDb(), PASSWORD);
    const to = testDb();
    updateSettings(to, { lockTimeoutSec: 900, blockScreenshots: false, lastBackupAt: '2026-09-01T00:00:00Z' });
    setEntitlement(to, { isPro: true, source: 'test', checkedAt: null });
    replaceAll(to, await readBackup(file, PASSWORD));

    expect(getSettings(to)).toMatchObject({
      strategy: 'avalanche',
      budgetMinor: 300_000,
      lockTimeoutSec: 900,
      blockScreenshots: false,
      lastBackupAt: '2026-09-01T00:00:00Z',
    });
    expect(getEntitlement(to).isPro).toBe(true);
  });

  it('never puts readable data in the file', async () => {
    const file = await exportBackup(filledDb(), PASSWORD);
    expect(file).not.toMatch(/Everyday|PHP|1000000/);
  });
});

describe('readBackup', () => {
  it('rejects a wrong password', async () => {
    const file = await exportBackup(filledDb(), PASSWORD);
    await expect(readBackup(file, 'wrong password')).rejects.toThrow(WrongPasswordError);
  });

  it('rejects a tampered file', async () => {
    const env = JSON.parse(await exportBackup(filledDb(), PASSWORD));
    env.data = (env.data[0] === '0' ? '1' : '0') + env.data.slice(1);
    await expect(readBackup(JSON.stringify(env), PASSWORD)).rejects.toThrow(WrongPasswordError);
  });

  it('rejects files that are not backups', async () => {
    await expect(readBackup('hello', PASSWORD)).rejects.toThrow(NotABackupError);
    await expect(readBackup('{"format":"other"}', PASSWORD)).rejects.toThrow(NotABackupError);
  });

  it('refuses scrypt costs that could freeze the phone', async () => {
    const env = JSON.parse(await exportBackup(filledDb(), PASSWORD));
    env.kdf.N = 2 ** 22;
    await expect(readBackup(JSON.stringify(env), PASSWORD)).rejects.toThrow(NotABackupError);
  });

  it('refuses a backup from a newer app', async () => {
    const env = JSON.parse(await exportBackup(filledDb(), PASSWORD));
    env.v = 99;
    await expect(readBackup(JSON.stringify(env), PASSWORD)).rejects.toThrow(BackupTooNewError);
  });

  it('accepts the same password typed in another Unicode form', async () => {
    const file = await exportBackup(filledDb(), 'café latte');
    await expect(readBackup(file, 'café latte')).resolves.toBeTruthy();
  });

  it('has a data upgrade for every DB migration after v1', () => {
    expect(UPGRADES).toHaveLength(SCHEMA_VERSION - 1);
  });
});

describe('exportBackup', () => {
  it('requires a password of at least 8 characters', async () => {
    await expect(exportBackup(testDb(), 'short')).rejects.toThrow(/at least 8/);
  });
});

describe('replaceAll', () => {
  it('changes nothing when the backup has a bad row', async () => {
    const data = await readBackup(await exportBackup(filledDb(), PASSWORD), PASSWORD);
    data.transactions[1] = { ...data.transactions[1], amountMinor: 1.5 }; // money must be integers

    const to = testDb();
    const keep = createDebt(to, card, { balanceMinor: 42, on: '2026-01-01' });
    expect(() => replaceAll(to, data)).toThrow(/CHECK/);
    expect(listDebts(to).map((d) => d.id)).toEqual([keep]);
    expect(listTransactions(to, keep)).toHaveLength(1);
  });

  it('rejects a reversal that points at a missing transaction', async () => {
    const data = await readBackup(await exportBackup(filledDb(), PASSWORD), PASSWORD);
    data.transactions = data.transactions.filter((t) => t.type !== 'payment');
    const to = testDb();
    const keep = createDebt(to, card, { balanceMinor: 42, on: '2026-01-01' });
    expect(() => replaceAll(to, data)).toThrow(); // foreign keys are checked at commit
    expect(listDebts(to).map((d) => d.id)).toEqual([keep]);
    expect(listTransactions(to, keep)).toHaveLength(1);
  });
});
