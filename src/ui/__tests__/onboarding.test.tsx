import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Budget from '@/app/(onboarding)/budget';
import DebtForm from '@/app/(onboarding)/debt-form';
import Strategy from '@/app/(onboarding)/strategy';
import { testDb } from '@/db/__tests__/testDb';
import { createDebt, listDebts } from '@/db/repositories/debts';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { balances } from '@/db/repositories/transactions';
import { loadSnapshot, monthPlan } from '@/domain/dashboard';

// Screens 06 → 07 against a real (in-memory) DB: save a card, then finish onboarding on the budget screen.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));
const mockDb = testDb();
const db = mockDb;
jest.mock('@/db/client', () => ({ getAppDb: () => Promise.resolve(mockDb) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), dismissAll: jest.fn(), canGoBack: () => true } }));

it('saves a debt, then runs the plan and finishes onboarding', async () => {
  await render(<DebtForm />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save debt' })).toBeEnabled());
  await fireEvent.press(screen.getByRole('button', { name: 'Save debt' }));
  expect(screen.getByText('Enter the balance you owe.')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Nickname (optional)'), 'Everyday Card');
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
  expect(screen.getByLabelText('Monthly payoff budget amount').props.value).toBe('1,000');
  await fireEvent.press(screen.getByRole('button', { name: 'See my plan' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(getSettings(db)).toMatchObject({ budgetMinor: 100_000, onboardingDone: true });
});

it('picks the bank from a dropdown, then the network (R15, R16)', async () => {
  await render(<DebtForm />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save debt' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Bank: BDO' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Visa', selected: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Bank: BDO' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'UnionBank' }));
  expect(screen.getByRole('button', { name: 'Bank: UnionBank' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Mastercard' }));
  expect(screen.getByLabelText('Nickname (optional)').props.placeholder).toBe('UnionBank Mastercard');
  expect(screen.getByRole('button', { name: 'Visa (ex-Citi)' })).toBeTruthy();

  // One-card banks hide the network row; Custom asks for a name.
  await fireEvent.press(screen.getByRole('button', { name: 'Bank: UnionBank' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'AUB' }));
  expect(screen.queryByText('Card network')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Bank: AUB' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Custom' }));
  expect(screen.getByLabelText('Card name')).toBeTruthy();
});

it('names a Custom card and picks its color with sliders, not hex', async () => {
  await render(<DebtForm />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save debt' })).toBeEnabled());
  await fireEvent.press(screen.getByRole('button', { name: 'Bank: BDO' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Custom' }));

  // The card's top line follows the new field.
  await fireEvent.changeText(screen.getByLabelText('Bank or issuer (optional)'), 'GCash GCredit');
  expect(screen.getByText('GCash GCredit')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Custom card color' }));
  expect(screen.queryByLabelText('Card color (hex)')).toBeNull();
  const shade = screen.getByRole('adjustable', { name: 'Card shade' });
  await fireEvent(shade, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });

  await fireEvent.changeText(screen.getByLabelText('Card name'), 'Everyday');
  await fireEvent.changeText(screen.getByLabelText('Current balance'), '5,000');
  await fireEvent.changeText(screen.getByLabelText('Interest / month'), '3%');
  await fireEvent.changeText(screen.getByLabelText('Minimum payment'), '500');
  await fireEvent.changeText(screen.getByLabelText('Due day'), '15');
  await fireEvent.press(screen.getByRole('button', { name: 'Save debt' }));
  await waitFor(() => expect(listDebts(db).some((d) => d.nickname === 'Everyday')).toBe(true));
  const saved = listDebts(db).find((d) => d.nickname === 'Everyday')!;
  expect(saved).toMatchObject({ issuer: 'GCash GCredit', templateId: 'custom' });
  expect(saved.color).toMatch(/^#[0-9A-F]{6}$/);
  expect(saved.color).not.toBe('#4E5C54'); // moved off the template color
});

it('lists strategies with one example open at a time and a fixed Continue button (R14)', async () => {
  await render(<Strategy />);
  expect(screen.getByRole('radio', { name: /^Snowball/ })).toBeTruthy();
  expect(screen.queryByText('Example: pays off in this order')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Show example for Avalanche' }));
  expect(screen.getByText('Best if saving money matters most')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Show example for Snowball' }));
  expect(screen.queryByText('Best if saving money matters most')).toBeNull();
  expect(screen.getAllByText('Example: pays off in this order')).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Hide example for Snowball' }));
  expect(screen.queryByText('Example: pays off in this order')).toBeNull();

  // The button keeps its name whatever is picked; a Pro strategy opens the paywall.
  await fireEvent.press(screen.getByRole('radio', { name: /^Hybrid/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(router.push).toHaveBeenCalledWith('/pro');
  await fireEvent.press(screen.getByRole('radio', { name: /^Avalanche/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/debts'));
  expect(getSettings(db).strategy).toBe('avalanche');
  expect(screen.getByLabelText('Step 3 of 5')).toBeTruthy();
});

it('changes the budget after onboarding when new debts outgrow it', async () => {
  updateSettings(db, { onboardingDone: true, budgetMinor: 100_000, planStartMonth: '2026-10' });
  // A debt added later (e.g. after unlocking Pro) pushes the minimums past the saved budget.
  createDebt(
    db,
    { nickname: 'New loan', kind: 'personal_loan', color: '#1C3D73', currency: 'PHP', monthlyRate: '0', rateEnteredAs: 'monthly', minRule: 'fixed', minFixedMinor: 900_000, acceptsExtra: true, autoDeducted: false, dueDay: 15 },
    { balanceMinor: 5_000_000, on: '2026-11-01' },
  );
  expect(monthPlan(loadSnapshot(db)).shortfall).not.toBeNull();
  const before = getSettings(db);

  mockParams = { edit: '1' };
  try {
    await render(<Budget />);
    expect(await screen.findByText('Change your monthly budget')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save budget' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  } finally {
    mockParams = {};
  }
  // Starts at the new minimums, so saving clears the shortfall; onboarding isn't redone.
  expect(monthPlan(loadSnapshot(db)).shortfall).toBeNull();
  expect(getSettings(db)).toMatchObject({ onboardingDone: true, planStartMonth: before.planStartMonth });
  expect(getSettings(db).budgetMinor).toBeGreaterThan(before.budgetMinor!);
});

it('lets you type the budget; −/+ snap to round amounts (R22)', async () => {
  updateSettings(db, { onboardingDone: true, budgetMinor: 100_000, planStartMonth: '2026-10' });
  mockParams = { edit: '1' };
  try {
    await render(<Budget />);
    const amount = await screen.findByLabelText('Monthly payoff budget amount');

    // Below the minimums: a note, and Save waits.
    await fireEvent.changeText(amount, '1');
    expect(screen.getByText(/Your budget needs to cover at least that\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save budget' })).toBeDisabled();

    // Any amount can be typed, commas added as you go; + then goes to the next round ₱500.
    await fireEvent.changeText(amount, '30000.5');
    expect(amount.props.value).toBe('30,000.5');
    await fireEvent.press(screen.getByRole('button', { name: /^Raise to the next/ }));
    expect(amount.props.value).toBe('30,500');
    await fireEvent.press(screen.getByRole('button', { name: /^Lower to the next/ }));
    await fireEvent.press(screen.getByRole('button', { name: /^Lower to the next/ }));
    expect(amount.props.value).toBe('29,500');

    await fireEvent.press(screen.getByRole('button', { name: 'Save budget' }));
    await waitFor(() => expect(getSettings(db).budgetMinor).toBe(2_950_000));
  } finally {
    mockParams = {};
  }
});
