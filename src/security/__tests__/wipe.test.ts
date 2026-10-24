import * as Notifications from 'expo-notifications';

import { deleteAppDb } from '@/db/client';

import { deleteDbKey } from '../keyManager';
import { clearLockState } from '../pin';
import { deleteAllData } from '../wipe';

const mockOrder: string[] = [];
jest.mock('@/db/client', () => ({ deleteAppDb: jest.fn(async () => void mockOrder.push('db')) }));
jest.mock('../keyManager', () => ({ deleteDbKey: jest.fn(async () => void mockOrder.push('key')) }));
jest.mock('../pin', () => ({ clearLockState: jest.fn(async () => void mockOrder.push('lock')) }));
jest.mock('expo-notifications', () => ({ cancelAllScheduledNotificationsAsync: jest.fn(async () => void mockOrder.push('reminders')) }));
jest.mock('expo-screen-capture', () => ({ allowScreenCaptureAsync: jest.fn(async () => undefined) }));

beforeEach(() => {
  mockOrder.length = 0;
  jest.clearAllMocks();
});

it('deletes the DB file, then its key, reminders, and the lock record last', async () => {
  await deleteAllData();
  expect(mockOrder).toEqual(['db', 'key', 'reminders', 'lock']);
});

it('fails closed: if the DB file can’t be deleted, the key and lock stay', async () => {
  jest.mocked(deleteAppDb).mockRejectedValueOnce(new Error('busy'));
  await expect(deleteAllData()).rejects.toThrow('busy');
  expect(deleteDbKey).not.toHaveBeenCalled();
  expect(clearLockState).not.toHaveBeenCalled();
});

it('a reminder-cancel failure doesn’t stop the erase', async () => {
  jest.mocked(Notifications.cancelAllScheduledNotificationsAsync).mockRejectedValueOnce(new Error('off'));
  await deleteAllData();
  expect(clearLockState).toHaveBeenCalled();
});
