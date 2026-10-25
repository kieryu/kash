import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { CheckBadge } from './icons';

type Props = {
  name: string;
  how: string;
  best: string;
  /** Strategy illustration, drawn by the screen. */
  art: ReactNode;
  pro?: boolean;
  selected: boolean;
  /** Picked by the "Help me choose" quiz. */
  recommended?: boolean;
  onPress: () => void;
};

export function StrategyCard({ name, how, best, art, pro, selected, recommended, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${recommended ? 'Recommended for you. ' : ''}${name}${pro ? ', Pro' : ''}. ${how} ${best}`}
      onPress={onPress}
      style={[styles.card, selected && styles.selected]}
    >
      <View style={[styles.art, pro && styles.artPro]}>{art}</View>
      {recommended ? (
        <View style={styles.rec}>
          <Text style={styles.recChip}>Recommended for you</Text>
          <Text style={styles.recNote}>You can switch anytime.</Text>
        </View>
      ) : null}
      <View style={styles.head}>
        <Text style={styles.name}>{name}</Text>
        {pro && <Text style={styles.pro}>PRO</Text>}
        {selected && <CheckBadge size={26} color={colors.primary} checkColor={colors.onPrimary} />}
      </View>
      <Text style={styles.how}>{how}</Text>
      <Text style={styles.best}>{best}</Text>
    </Pressable>
  );
}

/** Carousel position dots under the strategy cards. Decorative: each card says if it's selected. */
export function PageDots({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
      ))}
    </View>
  );
}

const { colors, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  card: {
    width: size.strategyCardWidth,
    backgroundColor: colors.surface,
    borderRadius: radius.cardLg,
    borderWidth: 3,
    borderColor: colors.surface,
    padding: space.xl,
    gap: 14,
  },
  selected: { borderColor: colors.primary },
  art: { height: size.strategyArt, borderRadius: radius.card, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  artPro: { backgroundColor: colors.accentSoft },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
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
  rec: { gap: space.xs, alignItems: 'flex-start' },
  recChip: {
    ...type.captionBold,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  recNote: { ...type.caption, color: colors.muted },
  how: { ...type.body, color: colors.inkSoft },
  best: { ...type.label, color: colors.primary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.switchOff },
  dotOn: { width: space.xl, backgroundColor: colors.primary },
});
