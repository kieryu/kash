import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Dashboard from '@/app/(app)/(tabs)/index';
import DebtDetail from '@/app/(app)/debt/[id]';
import { testDb } from '@/db/__tests__/testDb';
import { createDebt, type NewDebt } from '@/db/repositories/debts';
import { updateSettings } from '@/db/repositories/settings';
import { balanceOf } from '@/db/repositories/transactions';

// 08 Dashboard and 09 Debt detail against a real (in-memory) DB.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));
const mockDb = testDb();
jest.mock('@/db/client', () => ({ getAppDb: () => Promise.resolve(mockDb) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/notifications/reminders', () => ({ rescheduleReminders: jest.fn(() => Promise.resolve()) }));
let mockId = '';
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { back: jest.fn(), push: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
    useLocalSearchParams: () => ({ id: mockId }),
  };
});

const card: NewDebt = {
  nickname: 'Everyday Card',
  kind: 'credit_card',
  color: '#1C3D73',
  currency: 'PHP',
  monthlyRate: '0.03',
  rateEnteredAs: 'monthly',
  minRule: 'fixed',
  minFixedMinor: 85_000,
  acceptsExtra: true,
  autoDeducted: false,
  dueDay: 28,
};
const cardId = createDebt(mockDb, card, { balanceMinor: 821_000, on: '2026-10-01' });
createDebt(mockDb, { ...card, nickname: 'Ate’s loan', monthlyRate: '0', minFixedMinor: 100_000, dueDay: 30 }, { balanceMinor: 2_300_000, on: '2026-10-01' });
updateSettings(mockDb, { budgetMinor: 653_500, onboardingDone: true });

it('logs the focus payment from the sheet, then undoes it', async () => {
  await render(<Dashboard />);
  expect(await screen.findByText('FOCUS DEBT · PAY EXTRA HERE')).toBeTruthy();
  expect(screen.getByText('₱850 min + ₱4,685 extra')).toBeTruthy();
  expect(screen.getByText('Minimum payments')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Log payment for Everyday Card' }));
  expect(screen.getByText('Log payment · Everyday Card')).toBeTruthy();
  expect(screen.getByText('Right on plan. Nice.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save payment' }));

  expect(await screen.findByText('Paid ₱5,535 · as planned')).toBeTruthy();
  expect(balanceOf(mockDb, cardId)).toBe(821_000 - 553_500);
  expect(screen.getByText('✓ Your last payment was right on plan')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Undo payment for Everyday Card' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Log payment for Everyday Card' })).toBeTruthy());
  expect(balanceOf(mockDb, cardId)).toBe(821_000);
});

it('hides balances and shows the covering-eyes mascot', async () => {
  await render(<Dashboard />);
  await screen.findByText('FOCUS DEBT · PAY EXTRA HERE');
  expect(screen.getAllByText('₱8,210').length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('switch', { name: 'Hide balances' }));
  await waitFor(() => expect(screen.queryAllByText('₱8,210')).toHaveLength(0));
  expect(screen.getByLabelText('Pomeranian mascot covering its eyes — balances hidden')).toBeTruthy();
  await fireEvent.press(screen.getByRole('switch', { name: 'Hide balances' }));
  await waitFor(() => expect(screen.getAllByText('₱8,210').length).toBeGreaterThan(0));
});

it('shows a debt’s stats and history', async () => {
  mockId = cardId;
  await render(<DebtDetail />);
  expect(await screen.findByText('History')).toBeTruthy();
  expect(screen.getByText('Starting balance')).toBeTruthy();
  expect(screen.getByText('3% / mo · 36% / yr')).toBeTruthy();
  expect(screen.getByText('28th')).toBeTruthy();
  expect(screen.getByText(/Everyday Card paid off|until Everyday Card is paid off/)).toBeTruthy();
});
