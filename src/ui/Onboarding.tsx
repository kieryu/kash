import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { IconButton } from './Button';
import { BackIcon, CheckBadge } from './icons';

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
  /** Back arrow left of the step bar (04a quiz). */
  onBack?: () => void;
};

/** Shared onboarding layout: step bar, H1 + body, content, pinned footer. */
export function OnboardingScreen({ step, art, title, body, children, footer, fullBleed, onBack }: Props) {
  const pad = fullBleed ? styles.padded : null;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, !fullBleed && styles.padded]} showsVerticalScrollIndicator={false}>
        <View style={[pad, onBack && styles.backRow]}>
          {onBack ? (
            <IconButton accessibilityLabel="Back" onPress={onBack}>
              <BackIcon size={24} color={colors.ink} />
            </IconButton>
          ) : null}
          <View style={styles.fill}>
            <StepBar step={step} />
          </View>
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

type AnswerProps = { title: string; caption?: string; selected: boolean; onPress: () => void };

/** Full-width answer card for the quiz. Put inside a View with accessibilityRole="radiogroup". */
export function AnswerCard({ title, caption, selected, onPress }: AnswerProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={caption ? `${title}. ${caption}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.answer, selected && styles.answerOn, pressed && styles.pressed]}
    >
      <View style={styles.answerText}>
        <Text style={styles.answerTitle}>{title}</Text>
        {caption ? <Text style={styles.answerCaption}>{caption}</Text> : null}
      </View>
      {selected ? <CheckBadge size={26} color={colors.primary} checkColor={colors.onPrimary} /> : null}
    </Pressable>
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
  backRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fill: { flex: 1 },
  answer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    padding: space.lg,
  },
  // 3px border; padding shrinks so the card doesn't jump.
  answerOn: { borderWidth: 3, borderColor: colors.primary, padding: space.lg - 1.5 },
  answerText: { flex: 1, gap: 2 },
  answerTitle: { ...type.rowTitle, color: colors.ink },
  answerCaption: { ...type.small, color: colors.muted },
  pressed: { opacity: 0.85 },
});
