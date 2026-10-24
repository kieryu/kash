import { BackupTooNewError, NotABackupError, WrongPasswordError, type BackupData } from '../backup';
import { backupFileName, backupSummary, importError } from '../preview';

it('names the file with the local date', () => {
  expect(backupFileName(new Date(2026, 0, 5, 23, 30))).toBe('kash-backup-2026-01-05.json');
});

it('sums what is owed per currency and counts debts', () => {
  const t = (debtId: string, currency: string, amountMinor: number) => ({ debtId, currency, amountMinor });
  const data = {
    exportedAt: '2026-10-24T02:00:00.000Z',
    debts: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    transactions: [t('a', 'PHP', 1_000_000), t('a', 'PHP', -50_000), t('b', 'PHP', 20_000), t('c', 'USD', 12_345)],
  } as unknown as BackupData;

  expect(backupSummary(data, 2)).toEqual({
    exportedAt: '2026-10-24T02:00:00.000Z',
    debts: 3,
    totals: [
      { currency: 'PHP', minor: 970_000 },
      { currency: 'USD', minor: 12_345 },
    ],
    replaced: 2,
  });
});

it('maps read errors to copy and where to go next', () => {
  expect(importError(new WrongPasswordError()).repick).toBe(false);
  expect(importError(new NotABackupError())).toEqual({ message: "This file isn’t a Kash backup.", repick: true });
  expect(importError(new BackupTooNewError(9)).message).toMatch(/newer version/);
  expect(importError(new Error('boom'))).toEqual({ message: 'Something went wrong reading this file. Nothing was changed.', repick: true });
});
