import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config/app';
import { clearFailures, verifyPin, waitRemaining, type LockState } from '@/security/pin';
import { theme } from '@/theme';

import { FingerprintIcon } from './icons';
import { PinPad } from './PinPad';

type Props = { lock: LockState; onUnlock: () => void };

// Errors that mean the phone has no biometrics or screen lock to prompt with.
const NO_DEVICE_LOCK = ['not_enrolled', 'passcode_not_set', 'not_available'];

function formatWait(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function wrongPinMessage(triesLeft: number): string {
  if (triesLeft === 0) return 'Wrong PIN.';
  return `Wrong PIN. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} before a short wait.`;
}

function forgotPin() {
  Alert.alert(
    'A PIN can’t be reset',
    `${APP_NAME} has no account or server, so there’s no reset. Use fingerprint, face or your phone’s passcode if you turned that on. Otherwise, only a backup file can restore your data.`,
  );
}

export function LockScreen({ lock, onUnlock }: Props) {
  const [mode, setMode] = useState<'bio' | 'pin'>(lock.biometrics ? 'bio' : 'pin');
  const [notice, setNotice] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState(() => Date.now() + waitRemaining(lock, Date.now()));
  const [now, setNow] = useState(Date.now);
  const waiting = waitUntil > now;

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  const tryBiometrics = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: `Unlock ${APP_NAME}` });
    if (r.success) {
      await clearFailures();
      return onUnlock();
    }
    if (!NO_DEVICE_LOCK.includes(r.error)) return setNotice(null);
    setNotice(
      lock.pin
        ? 'Fingerprint and phone passcode aren’t set up on this phone. Use your PIN.'
        : 'This phone has no screen lock now. Turn one on in your phone’s settings to unlock.',
    );
  }, [lock.pin, onUnlock]);

  // Prompt right away, after the lock screen has drawn.
  useEffect(() => {
    if (!lock.biometrics) return;
    const t = setTimeout(tryBiometrics, 0);
    return () => clearTimeout(t);
  }, [lock.biometrics, tryBiometrics]);

  const submitPin = async (pin: string) => {
    const r = await verifyPin(pin);
    if (r.ok) return onUnlock();
    setNotice(r.waitMs > 0 ? null : wrongPinMessage(r.triesLeft));
    setNow(Date.now());
    setWaitUntil(Date.now() + r.waitMs);
  };

  if (mode === 'pin' && lock.pin) {
    return (
      <PinPad
        tone="primary"
        title="Enter your PIN"
        message={waiting ? `Too many tries. Try again in ${formatWait(waitUntil - now)}.` : notice}
        disabled={waiting}
        onComplete={submitPin}
        onBiometrics={
          lock.biometrics
            ? () => {
                setMode('bio');
                tryBiometrics();
              }
            : undefined
        }
        onForgot={forgotPin}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* TODO(slice 4): sleeping mascot inside the halo. */}
      <View style={styles.halo} />
      <Text style={styles.title} accessibilityRole="header">
        {APP_NAME} is locked
      </Text>
      <Text style={styles.body}>Your data is encrypted on this phone. Unlock to continue.</Text>
      {notice ? (
        <Text style={styles.body} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      <View style={styles.spacer} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Unlock with fingerprint"
        onPress={tryBiometrics}
        style={({ pressed }) => [styles.bioButton, pressed && styles.pressed]}
      >
        <FingerprintIcon size={44} color={colors.primary} />
      </Pressable>
      <Text style={styles.hint}>Touch to unlock</Text>
      {lock.pin && (
        <Pressable accessibilityRole="button" onPress={() => {
            setNotice(null);
            setMode('pin');
          }} style={styles.link}>
          <Text style={styles.linkText}>Use PIN instead</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const { colors, space, size, type } = theme;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 96,
    paddingBottom: 48,
    gap: space.xl,
  },
  halo: { width: size.lockHalo, height: size.lockHalo, borderRadius: size.lockHalo / 2, backgroundColor: colors.primaryRaised },
  title: { ...type.title, color: colors.onPrimary, textAlign: 'center', marginTop: space.sm },
  body: { ...type.body, color: colors.onPrimaryMuted, textAlign: 'center', maxWidth: 280 },
  spacer: { flex: 1 },
  bioButton: {
    width: size.lockButton,
    height: size.lockButton,
    borderRadius: size.lockButton / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  hint: { ...type.bodySm, color: colors.onPrimaryMuted },
  link: { padding: space.md },
  linkText: { ...type.button, color: colors.onPrimary },
});
