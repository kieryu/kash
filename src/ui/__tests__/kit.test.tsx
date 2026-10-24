import { fireEvent, render, screen } from '@testing-library/react-native';

import { SegmentedControl, Switch } from '../Controls';
import { Mascot, mascotLabels, type MascotMood } from '../Mascot';
import { PaymentRow } from '../Payments';

it('draws every mascot mood with its text label', async () => {
  for (const mood of Object.keys(mascotLabels) as MascotMood[]) {
    await render(<Mascot mood={mood} />);
    expect(screen.getByLabelText(mascotLabels[mood])).toBeTruthy();
  }
});

it('switch reports its state and flips', async () => {
  const onChange = jest.fn();
  await render(<Switch value={false} onValueChange={onChange} accessibilityLabel="Hide balances" />);
  const sw = screen.getByRole('switch', { name: 'Hide balances' });
  expect(sw).not.toBeChecked();
  await fireEvent.press(sw);
  expect(onChange).toHaveBeenCalledWith(true);
});

it('segmented control marks the selected option', async () => {
  const onChange = jest.fn();
  const options = [
    { value: 'card', label: 'Card' },
    { value: 'loan', label: 'Loan' },
  ] as const;
  await render(<SegmentedControl options={options} value="card" onChange={onChange} accessibilityLabel="Debt type" />);
  expect(screen.getByRole('tab', { name: 'Card' })).toBeSelected();
  await fireEvent.press(screen.getByRole('tab', { name: 'Loan' }));
  expect(onChange).toHaveBeenCalledWith('loan');
});

it('payment row shows Log, Paid or Auto-deducted', async () => {
  const props = { color: 'red', name: 'Travel Card', sub: 'Due Nov 3', onLog: jest.fn(), onUndo: jest.fn() };
  await render(<PaymentRow {...props} status="due" />);
  await fireEvent.press(screen.getByLabelText('Log payment for Travel Card'));
  expect(props.onLog).toHaveBeenCalled();

  await render(<PaymentRow {...props} status="paid" />);
  await fireEvent.press(screen.getByLabelText('Travel Card paid. Tap to undo'));
  expect(props.onUndo).toHaveBeenCalled();

  await render(<PaymentRow {...props} status="auto" />);
  expect(screen.getByText('Auto-deducted')).toBeTruthy();
});
