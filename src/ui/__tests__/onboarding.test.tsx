import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Budget from '@/app/(onboarding)/budget';
import DebtForm from '@/app/(onboarding)/debt-form';
import { testDb } from '@/db/__tests__/testDb';
import { listDebts } from '@/db/repositories/debts';
import { getSettings } from '@/db/repositories/settings';
import { balances } from '@/db/repositories/transactions';

// Screens 06 → 07 against a real (in-memory) DB: save a card, then finish onboarding on the budget screen.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));
const mockDb = testDb();
const db = mockDb;
jest.mock('@/db/client', () => ({ getAppDb: () => Promise.resolve(mockDb) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), dismissAll: jest.fn() } }));

it('saves a debt, then runs the plan and finishes onboarding', async () => {
  await render(<DebtForm />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save debt' })).toBeEnabled());
  await fireEvent.press(screen.getByRole('button', { name: 'Save debt' }));
  expect(screen.getByText('Enter the balance you owe.')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Nickname'), 'Everyday Card');
  await fireEvent.changeText(screen.getByLabelText('Current balance'), '18,450');
  await fireEvent.changeText(screen.getByLabelText('Interest / month'), '3%');
  await fireEvent.changeText(screen.getByLabelText('Minimum payment'), '850');
  await fireEvent.changeText(screen.getByLabelText('Due day'), '28');
  expect(screen.getByText('= 36% a year.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save debt' }));
  await waitFor(() => expect(router.back).toHaveBeenCalled());

  const [debt] = listDebts(db);
  expect(debt).toMatchObject({ nickname: 'Everyday Card', issuer: 'BDO', minFixedMinor: 85_000, dueDay: 28 });
  expect(balances(db).get(debt.id)).toBe(1_845_000);

  await render(<Budget />);
  expect(await screen.findByText('You’ll be debt-free by')).toBeTruthy();
  // Floor ₱850 rounds up to the first ₱500 step.
  expect(screen.getAllByText('₱1,000').length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('button', { name: 'See my plan' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(getSettings(db)).toMatchObject({ budgetMinor: 100_000, onboardingDone: true });
});
