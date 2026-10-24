import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

const STEPS = 5;

/** "Step N of 5" bar at the top of onboarding screens 02–07. */
export function StepBar({ step }: { step: number }) {
  return (
    <View style={styles.steps} accessible accessibilityLabel={`Step ${step} of ${STEPS}`}>
      {Array.from({ length: STEPS }, (_, i) => (
        <View key={i} style={[styles.step, i < step && styles.stepOn]} />
      ))}
    </View>
  );
}

type Props = {
  step: number;
  /** Illustration between the step bar and the title (02, 03). */
  art?: ReactNode;
  title: string;
  body?: ReactNode;
  children?: ReactNode;
  /** Pinned below the scrolling content (primary button). */
  footer: ReactNode;
  /** Strategy carousel runs edge to edge. */
  fullBleed?: boolean;
};

/** Shared onboarding layout: step bar, H1 + body, content, pinned footer. */
export function OnboardingScreen({ step, art, title, body, children, footer, fullBleed }: Props) {
  const pad = fullBleed ? styles.padded : null;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, !fullBleed && styles.padded]} showsVerticalScrollIndicator={false}>
        <View style={pad}>
          <StepBar step={step} />
        </View>
        {art ? <View style={styles.art}>{art}</View> : null}
        <View style={[styles.head, pad]}>
          <Text accessibilityRole="header" style={styles.h1}>
            {title}
          </Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
        </View>
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </SafeAreaView>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, gap: space.xxl, paddingTop: space.xxl, paddingBottom: space.lg },
  padded: { paddingHorizontal: space.screenOnboarding },
  art: { alignItems: 'center' },
  head: { gap: 10 },
  h1: { ...type.h1, color: colors.ink },
  body: { ...type.body, color: colors.muted },
  footer: { paddingHorizontal: space.screenOnboarding, paddingBottom: space.xxl, paddingTop: space.md, gap: space.md },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.handle },
  stepOn: { backgroundColor: colors.primary },
});
