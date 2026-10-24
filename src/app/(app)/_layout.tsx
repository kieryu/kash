import * as Notifications from 'expo-notifications';
import { Redirect, router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { getAppDb } from '@/db/client';
import { getSettings } from '@/db/repositories/settings';
import { reminderHref, rescheduleReminders } from '@/notifications/reminders';
import { theme } from '@/theme';

// Main app. First launch goes to onboarding.
export default function AppLayout() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    getAppDb().then((db) => setOnboarded(getSettings(db).onboardingDone));
  }, []);

  useEffect(() => {
    if (!onboarded) return;
    getAppDb()
      .then((db) => rescheduleReminders(db))
      .catch(() => {});
    // Tapping a reminder (cold start or while running). Lands under the lock screen when locked.
    const open = (r: Notifications.NotificationResponse | null) => {
      const href = r ? reminderHref(r.notification.request.content.data) : null;
      Notifications.clearLastNotificationResponse(); // don't reopen it on the next mount
      if (href) router.push(href);
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [onboarded]);

  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/welcome" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }} />;
}
