import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { getAppDb } from '@/db/client';
import { getSettings } from '@/db/repositories/settings';
import { theme } from '@/theme';

// Main app. First launch goes to onboarding.
export default function AppLayout() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    getAppDb().then((db) => setOnboarded(getSettings(db).onboardingDone));
  }, []);

  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/welcome" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }} />;
}
