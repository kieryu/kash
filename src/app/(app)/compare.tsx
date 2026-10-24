import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { updateSettings } from '@/db/repositories/settings';
import type { Settings } from '@/db/schema';
import { outcome, tradeOff, type StrategyKey, type StrategyOutcome } from '@/domain/compare';
import { budgetOf, loadSnapshot, moneyText, type Snapshot } from '@/domain/dashboard';
import { formatYearMonth } from '@/domain/format';
import { theme } from '@/theme';
import { BackScreen } from '@/ui/Backup';
import { Button } from '@/ui/Button';

const NAMES: Record<StrategyKey, string> = { snowball: 'Snowball', avalanche: 'Avalanche', custom: 'My own order' };

// 11 Compare strategies. Switching saves the strategy; the dashboard recalculates on focus.
export default function Compare() {
  const [snap, setSnap] = useState<(Snapshot & { settings: Settings }) | null>(null);
  const refresh = useCallback(() => {
    getAppDb().then((db) => setSnap(loadSnapshot(db)));
  }, []);
  useFocusEffect(refresh);

  const results = useMemo(() => (snap ? { snowball: outcome(snap, 'snowball'), avalanche: outcome(snap, 'avalanche') } : null), [snap]);
  if (!snap || !results) return null;

  const current = snap.settings.strategy;
  const money = (n: number) => moneyText(n, snap.settings.homeCurrency, snap.settings.hideBalances);
  const budget = budgetOf(snap);
  const choose = async (s: StrategyKey) => {
    updateSettings(await getAppDb(), { strategy: s });
    refresh();
  };

  return (
    <BackScreen title="Compare strategies" onBack={() => router.back()}>
      <Text style={styles.body}>Same {money(budget)} a month, different order.</Text>
      {(['snowball', 'avalanche'] as const).map((k) => (
        <ResultCard key={k} name={NAMES[k]} result={results[k]} current={k === current} money={money} onSwitch={() => choose(k)} />
      ))}
      <View style={styles.tradeOff}>
        <Text style={styles.tradeOffText}>
          <Text style={styles.strong}>The trade-off: </Text>
          {tradeOff(results.snowball, results.avalanche, money)}
        </Text>
      </View>

      <View style={styles.rows}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={current === 'custom' ? 'My own order, current strategy' : 'Switch to my own order'}
          disabled={current === 'custom'}
          onPress={() => choose('custom')}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.rowTitle}>My own order</Text>
          <Text style={styles.small}>{current === 'custom' ? 'Current · order you added debts' : 'Switch'}</Text>
        </Pressable>
        {/* Pro strategies (v1.1): open the paywall. */}
        {['Highest cost first', 'Hybrid'].map((name) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${APP_NAME} Pro`}
            onPress={() => router.push('/pro')}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.rowTitle}>{name}</Text>
            <Text style={styles.pro}>PRO</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.footnote}>Estimates only. Not financial advice.</Text>
    </BackScreen>
  );
}

type CardProps = { name: string; result: StrategyOutcome; current: boolean; money: (n: number) => string; onSwitch: () => void };

function ResultCard({ name, result, current, money, onSwitch }: CardProps) {
  const ym = (m: string | undefined) => (m ? formatYearMonth(m, undefined, 'short') : '—');
  return (
    <View style={[styles.card, current && styles.cardCurrent]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{name}</Text>
        {current ? <Text style={styles.currentChip}>CURRENT</Text> : null}
      </View>
      <View style={styles.stats}>
        <Stat label="Debt-free" value={ym(result?.debtFree)} />
        <Stat label="Total interest" value={result ? money(result.interest) : '—'} />
        <Stat label="First debt gone" value={ym(result?.firstGone)} />
      </View>
      {current ? null : <Button variant="secondary" label={`Switch to ${name}`} onPress={onSwitch} />}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  body: { ...type.body, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.cardLg - 2, padding: 18, gap: 14, borderWidth: 3, borderColor: colors.surface },
  cardCurrent: { borderColor: colors.primary },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...type.sectionTitle, color: colors.ink },
  currentChip: { ...type.captionBold, color: colors.onPrimary, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: space.xs, paddingHorizontal: 10, overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, gap: 2 },
  caption: { ...type.caption, color: colors.muted },
  statValue: { ...type.rowTitle, color: colors.ink },
  tradeOff: { backgroundColor: colors.primarySoft, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: space.lg },
  tradeOffText: { ...type.bodySm, color: colors.onPrimarySoft },
  strong: { ...type.rowTitleSm, color: colors.onPrimarySoft },
  rows: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: space.lg, minHeight: 48 },
  rowTitle: { ...type.rowTitle, color: colors.ink },
  small: { ...type.small, color: colors.muted },
  pro: { ...type.captionBold, color: colors.proChipText, backgroundColor: colors.proChipBg, borderRadius: radius.pill, paddingVertical: space.xs, paddingHorizontal: 10, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  footnote: { ...type.caption, color: colors.muted, textAlign: 'center' },
});
