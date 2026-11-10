import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import DebtForm from '@/app/(onboarding)/debt-form';
import { testDb } from '@/db/__tests__/testDb';
import { listDebts } from '@/db/repositories/debts';
import { balanceOf } from '@/db/repositories/transactions';

// R20: add a card whose statement total includes a running installment, then edit it.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));
const mockDb = testDb();
const db = mockDb;
jest.mock('@/db/client', () => ({ getAppDb: () => Promise.resolve(mockDb) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), dismissAll: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true } }));

async function fillCard() {
  await fireEvent.changeText(screen.getByLabelText('Nickname (optional)'), 'Everyday Card');
  await fireEvent.changeText(screen.getByLabelText('Interest / month'), '3%');
  await fireEvent.changeText(screen.getByLabelText('Minimum payment'), '500');
  await fireEvent.changeText(screen.getByLabelText('Due day'), '28');
}

it('asks about installments first, then takes the statement total and splits it', async () => {
  mockParams = {};
  await render(<DebtForm />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save debt' })).toBeEnabled());
  await fillCard();
  await fireEvent.press(screen.getByRole('button', { name: 'Yes' }));
  expect(screen.getByLabelText('Statement balance')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('What for? (optional)'), 'Phone');
  await fireEvent.changeText(screen.getByLabelText('Monthly amount'), '2,000');
  await fireEvent.changeText(screen.getByLabelText('Statement shows'), '3');
  await fireEvent.changeText(screen.getByLabelText('Out of'), '10');

  // A total lower than this month's installment can't be right.
  await fireEvent.changeText(screen.getByLabelText('Statement balance'), '1,500');
  await fireEvent.press(screen.getByRole('button', { name: 'Save debt' }));
  expect(await screen.findByText(/It includes this month’s installments/)).toBeTruthy();
  expect(listDebts(db)).toHaveLength(0);

  await fireEvent.changeText(screen.getByLabelText('Statement balance'), '10,000');
  await fireEvent.press(screen.getByRole('button', { name: 'Save debt' }));
  await waitFor(() => expect(listDebts(db)).toHaveLength(2));
  const card = listDebts(db).find((d) => !d.parentDebtId)!;
  const phone = listDebts(db).find((d) => d.parentDebtId === card.id)!;
  expect(balanceOf(db, card.id)).toBe(800_000);
  expect(phone).toMatchObject({ nickname: 'Phone', installmentTotal: 10 });
  expect(balanceOf(db, phone.id)).toBe(1_600_000);
});

it('edits the installment as "X of Y"', async () => {
  const card = listDebts(db).find((d) => !d.parentDebtId)!;
  const phone = listDebts(db).find((d) => d.parentDebtId === card.id)!;
  mockParams = { id: card.id };
  await render(<DebtForm />);
  await waitFor(() => expect(screen.getByDisplayValue('Phone')).toBeTruthy());
  expect(screen.getByLabelText('Statement shows').props.value).toBe('3');
  await fireEvent.changeText(screen.getByLabelText('Statement shows'), '4');
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(balanceOf(db, phone.id)).toBe(1_400_000));
  expect(balanceOf(db, card.id)).toBe(800_000);
});
