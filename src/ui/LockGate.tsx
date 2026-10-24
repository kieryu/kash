import * as ScreenCapture from 'expo-screen-capture';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { getSettings } from '@/db/repositories/settings';
import { getLockState, lockEnabled, type LockState } from '@/security/pin';
import { theme } from '@/theme';

import { LockScreen } from './LockScreen';

type Props = { onReady: () => void; children: ReactNode };

/**
 * Opens the DB, then covers the app with the lock screen on launch and when it comes back
 * from the background after the auto-lock timeout. The app stays mounted underneath so
 * navigation state survives, but is hidden from screen readers while locked.
 */
export function LockGate({ onReady, children }: Props) {
  const [lock, setLock] = useState<LockState | null>(null);
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const showLock = locked && lock !== null && lockEnabled(lock);
  const lockShown = useRef(showLock);

  useEffect(() => {
    (async () => {
      const [db, state] = await Promise.all([getAppDb(), getLockState()]);
      const s = getSettings(db);
      if (s.blockScreenshots) await ScreenCapture.preventScreenCaptureAsync();
      setLock(state);
      setLocked(lockEnabled(state));
    })()
      .catch((e: unknown) => setError(e instanceof Error ? e.name : 'Error'))
      .finally(onReady);
  }, [onReady]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next === 'background') {
        // The biometric prompt can pause the app on Android; that mustn't count as leaving.
        if (!lockShown.current) backgroundedAt.current = Date.now();
        return;
      }
      if (next !== 'active' || backgroundedAt.current === null) return;
      const away = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      try {
        // Read fresh: the PIN or the timeout may have changed since launch.
        const [db, state] = await Promise.all([getAppDb(), getLockState()]);
        if (lockEnabled(state) && away >= getSettings(db).lockTimeoutSec * 1000) {
          setLock(state);
          setLocked(true);
        }
      } catch {
        setLocked(true); // fail closed
      }
    });
    return () => sub.remove();
  }, []);

  // Hardware back must not navigate the app hidden under the lock screen.
  useEffect(() => {
    lockShown.current = showLock;
    if (!showLock) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [showLock]);

  if (error) {
    return (
      <SafeAreaView style={styles.error}>
        <Text style={styles.errorTitle}>{APP_NAME} couldn’t open your data</Text>
        <Text style={styles.errorBody}>Nothing was changed or deleted. Close the app and open it again. ({error})</Text>
      </SafeAreaView>
    );
  }
  if (!lock) return null;

  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        accessibilityElementsHidden={showLock}
        importantForAccessibility={showLock ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {showLock && (
        <View style={StyleSheet.absoluteFill}>
          <StatusBar style="light" />
          <LockScreen lock={lock} onUnlock={() => setLocked(false)} />
        </View>
      )}
    </View>
  );
}

const { colors, space, type } = theme;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  error: { flex: 1, backgroundColor: colors.bg, padding: space.screenOnboarding, justifyContent: 'center', gap: space.md },
  errorTitle: { ...type.sectionTitle, color: colors.ink },
  errorBody: { ...type.body, color: colors.muted },
});
