import * as Notifications from 'expo-notifications';

import { createDebt, updateDebt } from '@/db/repositories/debts';
import { updateSettings } from '@/db/repositories/settings';
import type { DebtRow } from '@/db/schema';
import { testDb } from '@/db/__tests__/testDb';

import { planReminders, reminderHref, rescheduleReminders } from '../reminders';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(async () => null),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
}));

const debt = (over: Partial<DebtRow>): DebtRow =>
  ({ id: 'd1', nickname: 'Everyday Card', dueDay: null, statementDay: null, autoDeducted: false, archivedAt: null, paidOffOn: null, ...over }) as DebtRow;

// Local dates at 9:00, as scheduled.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9);
const NOW = new Date(2027, 0, 10, 12); // 10 Jan 2027, noon

describe('planReminders', () => {
  it('due date: N days before and on the day, for 3 months, skipping past ones', () => {
    const r = planReminders([debt({ dueDay: 12 })], 3, NOW);
    // 9 Jan (3 days before 12 Jan) is already past.
    expect(r.map((x) => [x.kind, x.at])).toEqual([
      ['due_today', at(2027, 1, 12)],
      ['due_before', at(2027, 2, 9)],
      ['due_today', at(2027, 2, 12)],
      ['due_before', at(2027, 3, 9)],
      ['due_today', at(2027, 3, 12)],
    ]);
    expect(r[1]).toMatchObject({ title: 'Payment due soon', body: 'Everyday Card is due in 3 days.' });
    expect(r[0].body).toBe('Everyday Card is due today.');
  });

  it('clamps day 31 to the end of short months (Feb 28, leap Feb 29)', () => {
    expect(planReminders([debt({ statementDay: 31 })], 3, NOW).map((x) => x.at)).toEqual([
      at(2027, 1, 31),
      at(2027, 2, 28),
      at(2027, 3, 31),
    ]);
    expect(planReminders([debt({ dueDay: 31 })], 0, new Date(2028, 1, 1)).map((x) => x.at)[0]).toEqual(at(2028, 2, 29));
  });

  it('days-before crosses into the previous month', () => {
    const r = planReminders([debt({ dueDay: 2 })], 5, NOW);
    expect(r.filter((x) => x.kind === 'due_before').map((x) => x.at)).toEqual([at(2027, 1, 28), at(2027, 2, 25)]);
  });

  it('uses the days-before setting: 1 = "tomorrow", 0 = on the day only', () => {
    expect(planReminders([debt({ dueDay: 20 })], 1, NOW)[0]).toMatchObject({ at: at(2027, 1, 19), body: 'Everyday Card is due tomorrow.' });
    expect(planReminders([debt({ dueDay: 20 })], 0, NOW).every((x) => x.kind === 'due_today')).toBe(true);
  });

  it('statement reminder asks for the balance, never shows amounts', () => {
    const [s] = planReminders([debt({ statementDay: 15 })], 3, NOW);
    expect(s).toMatchObject({ kind: 'statement', at: at(2027, 1, 15), title: 'Statement day', body: 'Update your Everyday Card balance' });
    expect(`${s.title} ${s.body}`).not.toMatch(/\d/);
  });

  it('skips archived, paid-off, and due reminders for auto-deducted debts', () => {
    expect(planReminders([debt({ dueDay: 20, statementDay: 15, archivedAt: '2027-01-01T00:00:00Z' })], 3, NOW)).toEqual([]);
    expect(planReminders([debt({ dueDay: 20, statementDay: 15, paidOffOn: '2027-01-01' })], 3, NOW)).toEqual([]);
    const auto = planReminders([debt({ dueDay: 20, statementDay: 15, autoDeducted: true })], 3, NOW);
    expect(auto.map((x) => x.kind)).toEqual(['statement', 'statement', 'statement']);
  });

  it('keeps the soonest 60 across many debts', () => {
    const many = Array.from({ length: 30 }, (_, i) => debt({ id: `d${i}`, dueDay: (i % 28) + 1, statementDay: 15 }));
    const r = planReminders(many, 3, NOW);
    expect(r).toHaveLength(60);
    expect(r.every((x, i) => i === 0 || r[i - 1].at <= x.at)).toBe(true);
  });
});

describe('rescheduleReminders', () => {
  it('cancels ours first, then schedules from the DB and settings', async () => {
    const db = testDb();
    const base = {
      kind: 'credit_card' as const,
      color: '#1C3D73',
      currency: 'PHP',
      monthlyRate: '0.03',
      rateEnteredAs: 'monthly' as const,
      minRule: 'fixed' as const,
      minFixedMinor: 50_000,
      acceptsExtra: true,
      autoDeducted: false,
    };
    createDebt(db, { ...base, nickname: 'Card', dueDay: 20 }, { balanceMinor: 100_000, on: '2027-01-01' });
    const gone = createDebt(db, { ...base, nickname: 'Old', dueDay: 20 }, { balanceMinor: 0, on: '2027-01-01' });
    updateDebt(db, gone, { archivedAt: '2027-01-02T00:00:00Z' });
    updateSettings(db, { reminderDaysBefore: 2 });

    await rescheduleReminders(db, NOW);

    const cancel = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;
    const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(schedule.mock.invocationCallOrder[0]);
    expect(schedule).toHaveBeenCalledTimes(6);
    expect(schedule.mock.calls[0][0]).toMatchObject({
      content: { title: 'Payment due soon', body: 'Card is due in 2 days.', data: { kind: 'due_before' } },
      trigger: { type: 'date', date: at(2027, 1, 18), channelId: 'reminders' },
    });
  });
});

describe('reminderHref', () => {
  it('opens check-in for statement reminders only', () => {
    expect(reminderHref({ kind: 'statement', debtId: 'd1' })).toBe('/check-in/d1');
    expect(reminderHref({ kind: 'due_today', debtId: 'd1' })).toBeNull();
    expect(reminderHref({ kind: 'statement' })).toBeNull();
    expect(reminderHref({ kind: 'statement', debtId: 5 })).toBeNull();
    expect(reminderHref(null)).toBeNull();
  });
});
