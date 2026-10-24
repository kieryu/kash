import { APP_NAME } from '@/config/app';

import { BackupTooNewError, NotABackupError, WrongPasswordError, type BackupData } from './backup';

/** "kash-backup-2026-10-24.json" (local date). */
export function backupFileName(now = new Date()): string {
  const d = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  return `${APP_NAME.toLowerCase()}-backup-${d}.json`;
}

/** "24 Oct 2026", local date. */
export function formatBackupDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export type BackupSummary = {
  exportedAt: string;
  debts: number;
  /** Total owed per currency, minor units (balance = sum of transactions, D12). */
  totals: { currency: string; minor: number }[];
  /** Debts on this phone that the import will delete. */
  replaced: number;
};

/** What the import preview shows: counts and totals only. */
export function backupSummary(data: BackupData, phoneDebts: number): BackupSummary {
  const totals = new Map<string, number>();
  for (const t of data.transactions) totals.set(t.currency, (totals.get(t.currency) ?? 0) + t.amountMinor);
  return {
    exportedAt: data.exportedAt,
    debts: data.debts.length,
    totals: [...totals].map(([currency, minor]) => ({ currency, minor })),
    replaced: phoneDebts,
  };
}

/** Message for a failed `readBackup`, and whether to go back to picking a file. */
export function importError(e: unknown): { message: string; repick: boolean } {
  if (e instanceof WrongPasswordError) {
    return {
      message: "That password didn’t work. Check it and try again. Without the right password, this file can’t be opened.",
      repick: false,
    };
  }
  if (e instanceof NotABackupError) return { message: `This file isn’t a ${APP_NAME} backup.`, repick: true };
  if (e instanceof BackupTooNewError) {
    return { message: `This backup is from a newer version of ${APP_NAME}. Update the app, then import again.`, repick: true };
  }
  return { message: 'Something went wrong reading this file. Nothing was changed.', repick: true };
}
