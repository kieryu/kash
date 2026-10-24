import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { verifyPin, type LockState } from '@/security/pin';

import { LockScreen } from '../LockScreen';

jest.mock('@/security/pin', () => ({
  verifyPin: jest.fn(),
  clearFailures: jest.fn(),
  waitRemaining: jest.fn(() => 0),
}));
jest.mock('expo-local-authentication', () => ({ authenticateAsync: jest.fn() }));

const pinOnly: LockState = {
  pin: { salt: '', hash: '', N: 1, r: 1, p: 1 },
  biometrics: false,
  failed: 0,
  lastFailAt: null,
};

async function enter(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByLabelText(d));
  await waitFor(() => expect(verifyPin).toHaveBeenCalledWith(pin));
}

beforeEach(() => jest.clearAllMocks());

it('unlocks with the right PIN', async () => {
  jest.mocked(verifyPin).mockResolvedValue({ ok: true });
  const onUnlock = jest.fn();
  await render(<LockScreen lock={pinOnly} onUnlock={onUnlock} />);
  await enter('4821');
  await waitFor(() => expect(onUnlock).toHaveBeenCalled());
});

it('says how many tries are left after a wrong PIN', async () => {
  jest.mocked(verifyPin).mockResolvedValue({ ok: false, waitMs: 0, triesLeft: 2 });
  await render(<LockScreen lock={pinOnly} onUnlock={jest.fn()} />);
  await enter('0000');
  expect(await screen.findByText('Wrong PIN. 2 tries before a short wait.')).toBeTruthy();
});

it('shows the wait and disables the keys', async () => {
  jest.mocked(verifyPin).mockResolvedValue({ ok: false, waitMs: 30_000, triesLeft: 0 });
  await render(<LockScreen lock={pinOnly} onUnlock={jest.fn()} />);
  await enter('0000');
  expect(await screen.findByText(/Too many tries\. Try again in 0:(30|29)\./)).toBeTruthy();
  expect(screen.getByLabelText('1')).toBeDisabled();
});
