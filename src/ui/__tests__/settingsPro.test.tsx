import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import Dashboard from '@/app/(app)/(tabs)/index';
import Settings from '@/app/(app)/(tabs)/settings';
import Pro from '@/app/pro';
import { testDb } from '@/db/__tests__/testDb';
import { createDebt, type NewDebt } from '@/db/repositories/debts';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { rescheduleReminders } from '@/notifications/reminders';
import { deleteAllData } from '@/security/wipe';

// 12 Settings, 13 Kash Pro and free-limit gating against a real (in-memory) DB.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));
const mockDb = testDb();
jest.mock('@/db/client', () => ({ getAppDb: () => Promise.resolve(mockDb) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/notifications/reminders', () => ({ rescheduleReminders: jest.fn(() => Promise.resolve()) }));
jest.mock('@/dev/dbSelfCheck', () => ({ runDbSelfCheck: jest.fn() }));
jest.mock('@/security/wipe', () => ({ deleteAllData: jest.fn(() => Promise.resolve()) }));
jest.mock('@/security/pin', () => ({
  ...jest.requireActual('@/security/pin'),
  getLockState: jest.fn(async () => ({ pin: { salt: '', hash: '', N: 1, r: 1, p: 1 }, biometrics: false, failed: 0, lastFailAt: null })),
}));
jest.mock('expo-local-authentication', () => ({ authenticateAsync: jest.fn() }));
jest.mock('expo-screen-capture', () => ({ preventScreenCaptureAsync: jest.fn(), allowScreenCaptureAsync: jest.fn() }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

const card: NewDebt = {
  nickname: 'Card 1',
  kind: 'credit_card',
  color: '#1C3D73',
  currency: 'PHP',
  monthlyRate: '0.03',
  rateEnteredAs: 'monthly',
  minRule: 'fixed',
  minFixedMinor: 50_000,
  acceptsExtra: true,
  autoDeducted: false,
  dueDay: 28,
};
for (let i = 1; i <= 4; i++) createDebt(mockDb, { ...card, nickname: `Card ${i}` }, { balanceMinor: 100_000 * i, on: '2026-10-01' });
updateSettings(mockDb, { budgetMinor: 400_000, onboardingDone: true });

beforeEach(() => jest.clearAllMocks());

it('free plan: the 4th debt is read-only — logging it opens Kash Pro, the others still log', async () => {
  await render(<Dashboard />);
  expect(await screen.findByText(/1 more is read-only, but it still counts in your plan and totals/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Log payment for Card 4' }));
  expect(router.push).toHaveBeenCalledWith('/pro');
  await fireEvent.press(screen.getByRole('button', { name: 'Log payment for Card 2' }));
  expect(screen.getByText('Log payment · Card 2')).toBeTruthy();
});

it('paywall: billing isn’t live yet, so Unlock says so and nothing changes', async () => {
  await render(<Pro />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock for ₱99' }));
  expect(await screen.findByText(/Purchases open when Kash launches/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Maybe later' }));
  expect(router.back).toHaveBeenCalled();
});

it('reminder days: saves and reschedules', async () => {
  await render(<Settings />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Due-date reminders, 3 days before' }));
  await fireEvent.press(screen.getByRole('radio', { name: '7 days before' }));
  await waitFor(() => expect(getSettings(mockDb).reminderDaysBefore).toBe(7));
  expect(rescheduleReminders).toHaveBeenCalledWith(mockDb);
});

it('delete all data: two confirms, then erase and back to the start', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await render(<Settings />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete all data' }));
  alert.mock.calls[0][2]!.find((b) => b.text === 'Delete')!.onPress!();
  expect(deleteAllData).not.toHaveBeenCalled();
  expect(alert.mock.calls[1][0]).toBe('Are you sure?');
  alert.mock.calls[1][2]!.find((b) => b.text === 'Delete everything')!.onPress!();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/welcome'));
  expect(deleteAllData).toHaveBeenCalled();
});

it('home currency: "wrong currency" relabels; "convert" is not available yet', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await render(<Settings />);
  await fireEvent.press(await screen.findByRole('button', { name: /Home currency/ }));
  await fireEvent.press(screen.getByRole('radio', { name: /USD · US dollar/ }));
  const buttons = alert.mock.calls[0][2]!;
  buttons.find((b) => b.text?.startsWith('I moved'))!.onPress!();
  expect(alert.mock.calls[1][0]).toBe('Not available yet');
  expect(getSettings(mockDb).homeCurrency).toBe('PHP');
  buttons.find((b) => b.text === 'I picked the wrong currency')!.onPress!();
  await waitFor(() => expect(getSettings(mockDb).homeCurrency).toBe('USD'));
});
