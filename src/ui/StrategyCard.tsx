import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { theme } from '@/theme';

import { CheckBadge, ChevronDownIcon } from './icons';

type Props = {
  name: string;
  how: string;
  best: string;
  /** Strategy illustration, drawn by the screen. */
  art: ReactNode;
  /** Sample debts in the order this strategy pays them off (R4). */
  example?: { title: string; detail: string }[];
  pro?: boolean;
  selected: boolean;
  /** Picked by the "Help me choose" quiz. */
  recommended?: boolean;
  onPress: () => void;
  /** Example open. The screen keeps one open at a time. */
  open: boolean;
  onToggle: () => void;
};

// Reanimated follows the system "reduce motion" setting by default.
const DURATION = 220;
export const listTransition = LinearTransition.duration(DURATION);

/**
 * R14: one row in the vertical strategy list. Shows the name and one line of how it works;
 * the illustration, "best for" and the sample order sit in a "Show example" accordion.
 */
export function StrategyCard({ name, how, best, art, example, pro, selected, recommended, onPress, open, onToggle }: Props) {
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: DURATION }) }] }));
  return (
    <Animated.View layout={listTransition} style={[styles.card, selected && styles.selected]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${recommended ? 'Recommended for you. ' : ''}${name}${pro ? ', Pro' : ''}. ${how}`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        {recommended ? <Text style={styles.recChip}>Recommended for you</Text> : null}
        <View style={styles.head}>
          <Text style={styles.name}>{name}</Text>
          {pro && <Text style={styles.pro}>PRO</Text>}
          <View style={styles.spacer} />
          {selected ? <CheckBadge size={26} color={colors.primary} checkColor={colors.onPrimary} /> : <View style={styles.radio} />}
        </View>
        <Text style={styles.how}>{how}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? 'Hide' : 'Show'} example for ${name}`}
        onPress={onToggle}
        hitSlop={{ top: 4, bottom: 8 }}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>{open ? 'Hide example' : 'Show example'}</Text>
        <Animated.View style={chevron}>
          <ChevronDownIcon size={18} color={colors.primary} />
        </Animated.View>
      </Pressable>

      {open ? (
        <Animated.View entering={FadeIn.duration(DURATION)} exiting={FadeOut.duration(DURATION / 2)} style={styles.more}>
          <View style={[styles.art, pro && styles.artPro]}>{art}</View>
          <Text style={styles.best}>{best}</Text>
          {example ? (
            <View style={styles.example}>
              <Text style={styles.exampleTitle}>Example: pays off in this order</Text>
              {example.map((d, i) => (
                <View key={d.title} style={styles.exampleRow}>
                  <View style={styles.exampleNum}>
                    <Text style={styles.exampleNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.exampleText} numberOfLines={2}>
                    <Text style={styles.exampleName}>{d.title}</Text> · {d.detail}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const { colors, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardLg,
    borderWidth: 3,
    borderColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  selected: { borderColor: colors.primary },
  main: { gap: 6 },
  pressed: { opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spacer: { flex: 1 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.lineStrong },
  name: { ...type.sheetTitle, color: colors.ink, flexShrink: 1 },
  pro: {
    ...type.captionBold,
    color: colors.proChipText,
    backgroundColor: colors.proChipBg,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  recChip: {
    ...type.captionBold,
    alignSelf: 'flex-start',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  how: { ...type.body, color: colors.inkSoft },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 36 },
  toggleText: { ...type.label, color: colors.primary },
  more: { gap: space.md, paddingBottom: space.sm },
  art: { height: size.strategyArt, borderRadius: radius.card, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  artPro: { backgroundColor: colors.accentSoft },
  best: { ...type.label, color: colors.primary },
  example: { gap: 6, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: space.md },
  exampleTitle: { ...type.captionBold, color: colors.muted },
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  exampleNum: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  exampleNumText: { ...type.captionBold, color: colors.primary },
  exampleText: { ...type.small, color: colors.inkSoft, flex: 1 },
  exampleName: { ...type.captionBold, color: colors.ink },
});
