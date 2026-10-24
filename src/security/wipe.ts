import * as Notifications from 'expo-notifications';
import * as ScreenCapture from 'expo-screen-capture';

import { deleteAppDb } from '@/db/client';

import { deleteDbKey } from './keyManager';
import { clearLockState } from './pin';

/**
 * "Delete all data" and "erase after N wrong PINs" (same path, D19). Order matters (D14):
 * the DB file goes first; if that fails nothing else is touched, so the key still opens the data.
 * Deleting the key next makes any leftover copy unreadable. The lock record goes last, so an
 * interrupted erase-after-N runs again on the next launch.
 */
export async function deleteAllData(): Promise<void> {
  await deleteAppDb();
  await deleteDbKey();
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
  await clearLockState();
}
