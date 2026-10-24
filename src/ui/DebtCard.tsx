import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { theme } from '@/theme';

import { ProgressBar } from './Controls';

type Props = {
  /** full = debt form preview (168) · list = lists (150) · mini = dashboard carousel (148×92). */
  variant: 'full' | 'list' | 'mini';
  color: string;
  nickname: string;
  /** Already formatted (or masked when balances are hidden). */
  balanceText: string;
  /** Plain text only — no bank logos (CLAUDE.md §18). */
  issuer?: string;
  kindLabel?: string;
  network?: string | null;
  /** 0–1 paid off; mini only. */
  progress?: number;
  onPress?: () => void;
};

export function DebtCard({ variant, color, nickname, balanceText, issuer, kindLabel, network, progress = 0, onPress }: Props) {
  const label = [nickname, issuer, balanceText].filter(Boolean).join(', ');
  const body =
    variant === 'mini' ? (
      <>
        <Text style={styles.miniName} numberOfLines={1}>
          {nickname}
        </Text>
        <View style={styles.miniBottom}>
          <Text style={styles.miniBalance} numberOfLines={1}>
            {balanceText}
          </Text>
          <ProgressBar tone="card" value={progress} />
        </View>
      </>
    ) : (
      <>
        <Svg width={220} height={220} viewBox="0 0 220 220" style={styles.circles}>
          <Circle cx={110} cy={110} r={108} fill={colors.onPrimary} fillOpacity={0.07} />
          <Circle cx={110} cy={110} r={70} fill={colors.onPrimary} fillOpacity={0.06} />
        </Svg>
        <View style={styles.row}>
          <Text style={styles.issuer} numberOfLines={1}>
            {issuer}
          </Text>
          {kindLabel ? <Text style={styles.kind}>{kindLabel}</Text> : null}
        </View>
        <Svg width={32} height={24} viewBox="0 0 38 28">
          <Rect x={0.5} y={0.5} width={37} height={27} rx={5} fill={colors.cardChip} stroke={colors.cardChipLine} />
          <Path d="M0 10h12M0 18h12M26 10h12M26 18h12M12 0v28M26 0v28" stroke={colors.cardChipLine} strokeWidth={1} />
        </Svg>
        <View style={[styles.row, styles.bottom]}>
          <View style={styles.amount}>
            <Text style={styles.nickname} numberOfLines={1}>
              {nickname}
            </Text>
            <Text style={styles.balance} numberOfLines={1}>
              {balanceText}
            </Text>
          </View>
          {network ? <Text style={styles.network}>{network}</Text> : null}
        </View>
      </>
    );

  const style = [variant === 'mini' ? styles.mini : [styles.card, { height: variant === 'full' ? size.debtCardFull : size.debtCardList }], { backgroundColor: color }];

  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [style, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const { colors, opacity, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: space.xl,
    justifyContent: 'space-between',
    shadowColor: colors.ink,
    shadowOpacity: opacity.shadow,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  circles: { position: 'absolute', right: -70, top: -60 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  bottom: { alignItems: 'flex-end' },
  issuer: { ...type.cardIssuer, color: colors.onPrimary, flexShrink: 1 },
  kind: { ...type.micro, color: colors.onPrimary, opacity: 0.85 },
  amount: { gap: 2, flexShrink: 1 },
  nickname: { ...type.caption, color: colors.onPrimary, opacity: 0.85 },
  balance: { ...type.cardBalance, color: colors.onPrimary },
  network: { ...type.cardNetwork, color: colors.onPrimary, opacity: 0.9 },

  mini: {
    width: size.debtCardMiniWidth,
    height: size.debtCardMiniHeight,
    borderRadius: radius.card,
    padding: space.md,
    justifyContent: 'space-between',
  },
  miniName: { ...type.miniName, color: colors.onPrimary },
  miniBottom: { gap: 6 },
  miniBalance: { ...type.miniBalance, color: colors.onPrimary },
  pressed: { opacity: 0.85 },
});
