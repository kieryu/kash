import * as Notifications from 'expo-notifications';

import { listDebts } from '@/db/repositories/debts';
import { getSettings } from '@/db/repositories/settings';
import type { Db, DebtRow } from '@/db/schema';

// Local scheduled reminders only (CLAUDE.md §8). No push, no tokens.
// Text never includes amounts: it shows on the lock screen (CLAUDE.md §4).

const HOUR = 9; // 9:00 local time
const MONTHS_AHEAD = 3;
// ponytail: iOS keeps only 64 pending; we take the soonest 60 and rely on rescheduling at app open/data change.
// If the app isn't opened for ~3 months, reminders run out. Add a background refresh if that matters.
const MAX_PENDING = 60;

export type ReminderKind = 'due_before' | 'due_today' | 'statement';
export type Reminder = { debtId: string; kind: ReminderKind; at: Date; title: string; body: string };

/** Day `day` of the month, clamped to its last day (31 → 28/29 in Feb). */
function dayIn(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last), HOUR);
}

/** Pure: which reminders to schedule after `now`, soonest first. */
export function planReminders(debts: DebtRow[], daysBefore: number, now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const d of debts) {
    if (d.archivedAt || d.paidOffOn) continue;
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const y = now.getFullYear();
      const m = now.getMonth() + i;
      // Auto-deducted (e.g. salary-deducted SSS) needs no "pay now" nudge.
      if (d.dueDay && !d.autoDeducted) {
        const due = dayIn(y, m, d.dueDay);
        if (daysBefore > 0) {
          const before = new Date(due.getFullYear(), due.getMonth(), due.getDate() - daysBefore, HOUR);
          const when = daysBefore === 1 ? 'tomorrow' : `in ${daysBefore} days`;
          out.push({ debtId: d.id, kind: 'due_before', at: before, title: 'Payment due soon', body: `${d.nickname} is due ${when}.` });
        }
        out.push({ debtId: d.id, kind: 'due_today', at: due, title: 'Payment due today', body: `${d.nickname} is due today.` });
      }
      if (d.statementDay) {
        out.push({
          debtId: d.id,
          kind: 'statement',
          at: dayIn(y, m, d.statementDay),
          title: 'Statement day',
          body: `Update your ${d.nickname} balance`,
        });
      }
    }
  }
  return out
    .filter((r) => r.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_PENDING);
}

/** Cancels every scheduled reminder and schedules fresh ones. Call on app start and after debts/settings change. */
export async function rescheduleReminders(db: Db, now = new Date()): Promise<void> {
  // We're the app's only scheduler, so "cancel all" only removes ours.
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of planReminders(listDebts(db), getSettings(db).reminderDaysBefore, now)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { debtId: r.debtId, kind: r.kind } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
    });
  }
}
