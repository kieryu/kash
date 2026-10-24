import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { APP_NAME } from '@/config/app';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { OnboardingScreen } from '@/ui/Onboarding';

// 02 Privacy promise.
export default function Privacy() {
  return (
    <OnboardingScreen
      step={1}
      art={<PhoneLock />}
      title="Your money stays on this phone"
      body={`${APP_NAME} has no account, no cloud and no servers. Everything you enter is encrypted and saved only on this device.`}
      footer={
        <>
          <Text style={styles.tip}>Because nothing is online, keep an encrypted backup. You can export one anytime from Settings.</Text>
          <Button label="Continue" onPress={() => router.push('/secure')} />
        </>
      }
    >
      <View style={styles.promises}>
        <PromiseRow text="Works fully in airplane mode" icon={<Path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />} />
        <PromiseRow
          text="No email, no sign-up, no tracking"
          icon={
            <>
              <Circle cx={12} cy={8} r={4} />
              <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              <Path d="M3 3l18 18" />
            </>
          }
        />
        <PromiseRow
          text="We never ask for card numbers or CVV"
          icon={
            <>
              <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
              <Path d="M9 12l2 2 4-4" />
            </>
          }
        />
      </View>
    </OnboardingScreen>
  );
}

function PromiseRow({ text, icon }: { text: string; icon: ReactNode }) {
  return (
    <View style={styles.promise}>
      <View style={styles.iconBox}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </Svg>
      </View>
      <Text style={styles.promiseText}>{text}</Text>
    </View>
  );
}

function PhoneLock() {
  return (
    <Svg width={136} height={136} viewBox="0 0 168 168" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={84} cy={84} r={80} fill={colors.primarySoft} />
      <Rect x={52} y={28} width={64} height={112} rx={12} fill={colors.surface} stroke={colors.primary} strokeWidth={4} />
      <Rect x={72} y={36} width={24} height={4} rx={2} fill={colors.primary} />
      <Rect x={66} y={78} width={36} height={30} rx={6} fill={colors.primary} />
      <Path d="M74 78 V70 a10 10 0 0 1 20 0 V78" fill="none" stroke={colors.primary} strokeWidth={4} />
      <Circle cx={84} cy={91} r={4} fill={colors.accent} />
      <Rect x={82} y={92} width={4} height={8} rx={2} fill={colors.accent} />
    </Svg>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  promises: { gap: space.md },
  promise: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  promiseText: { ...type.rowTitleSm, color: colors.ink, flexShrink: 1 },
  tip: { ...type.small, color: colors.accentText, backgroundColor: colors.accentSoft, borderRadius: radius.inputLg, padding: space.md, overflow: 'hidden' },
});
