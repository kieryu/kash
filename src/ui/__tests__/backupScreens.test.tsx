import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import ExportBackup from '@/app/(app)/backup/export';
import ImportBackup from '@/app/(app)/backup/import';
import { exportBackup, readBackup, replaceAll, WrongPasswordError } from '@/backup/backup';
import { updateSettings } from '@/db/repositories/settings';
import { rescheduleReminders } from '@/notifications/reminders';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), dismissTo: jest.fn() } }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('expo-file-system', () => {
  class File {
    static pickFileAsync = jest.fn();
    uri = 'file:///cache/backup.json';
    exists = false;
    write = jest.fn();
    delete = jest.fn();
  }
  return { File, Paths: { cache: 'cache' } };
});
jest.mock('@/db/client', () => ({ getAppDb: jest.fn(async () => ({})) }));
jest.mock('@/db/repositories/settings', () => ({
  getSettings: jest.fn(() => ({ lastBackupAt: null })),
  updateSettings: jest.fn(),
}));
jest.mock('@/db/repositories/debts', () => ({ listDebts: jest.fn(() => [{}, {}]) }));
jest.mock('@/notifications/reminders', () => ({ rescheduleReminders: jest.fn(async () => undefined) }));
jest.mock('@/backup/backup', () => ({
  ...jest.requireActual('@/backup/backup'),
  exportBackup: jest.fn(async () => '{"format":"kash-backup"}'),
  readBackup: jest.fn(),
  replaceAll: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

it('exports only with a matching 8+ character password, then records the backup', async () => {
  await render(<ExportBackup />);
  const create = screen.getByRole('button', { name: 'Create backup file' });

  await fireEvent.changeText(screen.getByLabelText('Backup password'), 'correct horse');
  await fireEvent.changeText(screen.getByLabelText('Type it again'), 'correct hors');
  expect(screen.getByText('The passwords don’t match.')).toBeTruthy();
  expect(create).toBeDisabled();

  await fireEvent.changeText(screen.getByLabelText('Type it again'), 'correct horse');
  await fireEvent.press(create);

  expect(await screen.findByText(/Backup saved/)).toBeTruthy();
  expect(exportBackup).toHaveBeenCalledWith({}, 'correct horse');
  expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/backup.json', expect.anything());
  expect(updateSettings).toHaveBeenCalledWith({}, { lastBackupAt: expect.any(String) });
});

it('imports: wrong password stays on the step, then preview → confirm → replace', async () => {
  jest.mocked(File.pickFileAsync).mockResolvedValue({
    canceled: false,
    result: { name: 'kash-backup-2026-10-24.json', text: async () => 'file' },
  } as never);
  jest
    .mocked(readBackup)
    .mockRejectedValueOnce(new WrongPasswordError())
    .mockResolvedValueOnce({
      exportedAt: '2026-10-24T02:00:00.000Z',
      debts: [{}],
      transactions: [{ currency: 'PHP', amountMinor: 18_245_000 }],
    } as never);
  const alert = jest.spyOn(Alert, 'alert');

  await render(<ImportBackup />);
  await fireEvent.press(screen.getByRole('button', { name: 'Choose file' }));
  expect(await screen.findByText('kash-backup-2026-10-24.json')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Backup password'), 'nope');
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
  expect(await screen.findByText(/That password didn’t work/)).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Backup password'), 'correct horse');
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
  expect(await screen.findByText('Backup from 24 Oct 2026')).toBeTruthy();
  expect(screen.getByText(/This phone has 2 debts now/)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Replace all my data' }));
  expect(alert).toHaveBeenCalledWith('Replace all data?', expect.stringContaining('Your 2 debts'), expect.any(Array));
  const buttons = alert.mock.calls[0][2]!;
  buttons.find((b) => b.text === 'Replace')!.onPress!();

  await waitFor(() => expect(screen.getByText('Your data is here. Kash is ready.')).toBeTruthy());
  expect(replaceAll).toHaveBeenCalled();
  expect(rescheduleReminders).toHaveBeenCalled();
});
