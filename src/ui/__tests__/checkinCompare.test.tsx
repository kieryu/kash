import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import CheckIn from '@/app/(app)/check-in/[id]';
import Compare from '@/app/(app)/compare';
import { testDb } from '@/db/__tests__/testDb';
import { createDebt, type NewDebt } from '@/db/repositories/debts';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { balanceOf, listTransactions } from '@/db/repositories/transactions';

// 10 Check-in and 11 Compare against a real (in-memory) DB.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));
const mockDb = testDb();
jest.mock('@/db/client', () => ({ getAppDb: () => Promise.resolve(mockDb) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/notifications/reminders', () => ({ rescheduleReminders: jest.fn(() => Promise.resolve()) }));
let mockId = '';
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
    useLocalSearchParams: () => ({ id: mockId }),
  };
});

const card: NewDebt = {
  nickname: 'Travel Card',
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
  statementDay: 3,
};
const cardId = createDebt(mockDb, card, { balanceMinor: 2_300_000, on: '2026-10-01' });
createDebt(mockDb, { ...card, nickname: 'Ate’s loan', monthlyRate: '0', minFixedMinor: 100_000 }, { balanceMinor: 821_000, on: '2026-10-01' });
updateSettings(mockDb, { budgetMinor: 653_500, strategy: 'snowball', onboardingDone: true });

it('check-in: records new purchases and goes back', async () => {
  mockId = cardId;
  await render(<CheckIn />);
  expect(await screen.findByText('Update your Travel Card balance')).toBeTruthy();
  expect(screen.getByText('₱23,000')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Statement balance'), '24,269');
  expect(screen.getByText('Saved as interest and fees. Your projection corrects itself.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'New purchases' }));
  expect(screen.getByText('Saved as new charges. Your plan now includes them.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Save balance' }));
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(balanceOf(mockDb, cardId)).toBe(2_426_900);
  expect(listTransactions(mockDb, cardId)[0]).toMatchObject({ type: 'charge', amountMinor: 126_900 });
});

it('compare: shows both strategies and switches', async () => {
  await render(<Compare />);
  expect(await screen.findByText('CURRENT')).toBeTruthy();
  expect(screen.getByText(/The trade-off: Avalanche saves about/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Switch to Avalanche' }));
  await waitFor(() => expect(getSettings(mockDb).strategy).toBe('avalanche'));
  expect(await screen.findByRole('button', { name: 'Switch to Snowball' })).toBeTruthy();
});
