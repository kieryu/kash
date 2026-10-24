import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { runDbSelfCheck, type CheckStep } from '@/dev/dbSelfCheck';
import { getLockState, setBiometrics, type LockState } from '@/security/pin';
import { theme } from '@/theme';

// Placeholder home with dev tools. Replaced by onboarding / dashboard in later slices.
export default function Index() {
  const [steps, setSteps] = useState<CheckStep[] | null>(null);
  const [running, setRunning] = useState(false);
  const [lock, setLock] = useState<LockState | null>(null);
  const [timeoutSec, setTimeoutSec] = useState<number | null>(null);

  const refresh = useCallback(() => {
    getLockState().then(setLock);
    getAppDb().then((db) => setTimeoutSec(getSettings(db).lockTimeoutSec));
  }, []);
  useFocusEffect(refresh);

  const toggleBiometrics = async () => {
    if (!lock?.biometrics) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on biometric lock' });
      if (!r.success) return;
    }
    await setBiometrics(!lock?.biometrics);
    refresh();
  };

  const toggleTimeout = async () => {
    updateSettings(await getAppDb(), { lockTimeoutSec: timeoutSec === 0 ? 60 : 0 });
    refresh();
  };

  const run = async () => {
    setRunning(true);
    try {
      setSteps(await runDbSelfCheck());
    } finally {
      setRunning(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.wordmark}>{APP_NAME}</Text>
        <Text style={styles.body}>Development build · slice 3</Text>

        {__DEV__ && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>App lock</Text>
            <Text style={styles.caption}>
              PIN: {lock?.pin ? 'set' : 'not set'} · Biometrics: {lock?.biometrics ? 'on' : 'off'} · Auto-lock:{' '}
              {timeoutSec === 0 ? 'immediately' : `${timeoutSec ?? '…'} s`}
            </Text>
            <DevButton label={lock?.pin ? 'Change PIN' : 'Set PIN'} onPress={() => router.push('/pin-setup')} />
            <DevButton label={lock?.biometrics ? 'Turn off biometrics' : 'Turn on biometrics'} onPress={toggleBiometrics} />
            <DevButton label={timeoutSec === 0 ? 'Auto-lock after 1 min' : 'Auto-lock immediately'} onPress={toggleTimeout} />
          </View>
        )}

        {__DEV__ && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Encrypted database check</Text>
            <Pressable
              accessibilityRole="button"
              onPress={run}
              disabled={running}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>{running ? 'Checking…' : 'Run check'}</Text>
            </Pressable>
            {steps?.map((s) => (
              <View key={s.name} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {s.ok ? '✓' : '✗'} {s.name}
                </Text>
                {s.detail ? <Text style={styles.caption}>{s.detail}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const { colors, space, radius, size, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.screenApp, gap: space.lg },
  wordmark: { ...type.wordmark, color: colors.primary },
  body: { ...type.body, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg, gap: space.md },
  sectionTitle: { ...type.sectionTitle, color: colors.ink },
  button: {
    height: size.buttonPrimary,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  buttonText: { ...type.button, color: colors.onPrimary },
  row: { gap: space.xs },
  rowTitle: { ...type.rowTitleSm, color: colors.ink },
  caption: { ...type.caption, color: colors.muted },
});
