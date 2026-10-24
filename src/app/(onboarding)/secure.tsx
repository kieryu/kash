import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { APP_NAME } from '@/config/app';
import { getLockState, lockEnabled, setBiometrics } from '@/security/pin';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { FingerprintIcon } from '@/ui/icons';
import { NO_DEVICE_LOCK } from '@/ui/LockScreen';
import { OnboardingScreen } from '@/ui/Onboarding';

// 03 Secure the app. The PIN is set on the existing /pin-setup screen.
export default function Secure() {
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const waitingForPin = useRef(false);

  useFocusEffect(
    useCallback(() => {
      getLockState().then((s) => {
        setLocked(lockEnabled(s));
        if (waitingForPin.current && s.pin) {
          waitingForPin.current = false;
          router.push('/strategy');
        }
      });
    }, []),
  );

  const turnOnBiometrics = async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on biometric lock' });
    if (r.success) {
      await setBiometrics(true);
      return router.push('/strategy');
    }
    setNotice(NO_DEVICE_LOCK.includes(r.error) ? 'This phone has no fingerprint, face or screen lock set up. Set a PIN instead.' : null);
  };

  const setPin = () => {
    waitingForPin.current = true;
    router.push('/pin-setup');
  };

  return (
    <OnboardingScreen
      step={2}
      art={
        <View style={styles.halo}>
          <FingerprintIcon size={84} color={colors.primary} />
        </View>
      }
      title={`Lock ${APP_NAME} to keep it private`}
      body={`Open ${APP_NAME} with your fingerprint or face. Your phone’s passcode works as a backup, and you can add a ${APP_NAME} PIN too.`}
      footer={
        locked ? (
          <Button label="Continue" onPress={() => router.push('/strategy')} />
        ) : (
          <>
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <Button label="Turn on biometric lock" onPress={turnOnBiometrics} />
            <Button variant="secondary" label="Set a 4-digit PIN instead" onPress={setPin} />
          </>
        )
      }
    >
      <View style={styles.warning}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 8v5" />
          <Path d="M12 16.5v.5" />
        </Svg>
        <Text style={styles.warningText}>
          There’s no “forgot password” without an account. If you lose access to your PIN and biometrics, only a backup file can restore your data.
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  halo: { width: 152, height: 152, borderRadius: 76, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  warning: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg },
  warningText: { ...type.bodySm, color: colors.inkSoft, flex: 1 },
  notice: { ...type.small, color: colors.accentText, textAlign: 'center' },
});
