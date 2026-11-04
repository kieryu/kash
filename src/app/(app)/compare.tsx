import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { updateSettings } from '@/db/repositories/settings';
import type { Settings } from '@/db/schema';
import { breakdown, outcome, tradeOff, type Breakdown, type StrategyKey, type StrategyOutcome } from '@/domain/compare';
import { budgetOf, loadSnapshot, moneyText, type Snapshot } from '@/domain/dashboard';
import { formatYearMonth, timeUntil } from '@/domain/format';
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
  const details = useMemo(() => (snap ? { snowball: breakdown(snap, 'snowball'), avalanche: breakdown(snap, 'avalanche') } : null), [snap]);
  if (!snap || !results || !details) return null;

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
        <ResultCard
          key={k}
          name={NAMES[k]}
          result={results[k]}
          detail={details[k]}
          month={snap.month}
          current={k === current}
          money={money}
          onSwitch={() => choose(k)}
        />
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
          accessibilityState={{ disabled: current === 'custom' }}
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

type Money = (n: number) => string;
type CardProps = {
  name: string;
  result: StrategyOutcome;
  detail: Breakdown | null;
  month: string;
  current: boolean;
  money: Money;
  onSwitch: () => void;
};

const ym = (m: string | undefined) => (m ? formatYearMonth(m, undefined, 'short') : '—');

function ResultCard({ name, result, detail, month, current, money, onSwitch }: CardProps) {
  const [open, setOpen] = useState(false);
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
      {detail ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(!open)}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <Text style={styles.toggleText}>{open ? 'Hide the computation' : 'See the computation'}</Text>
        </Pressable>
      ) : null}
      {open && detail ? <Computation detail={detail} month={month} money={money} /> : null}
      {current ? null : <Button variant="secondary" label={`Switch to ${name}`} onPress={onSwitch} />}
    </View>
  );
}

// R7: how this strategy's numbers come from the user's own debts.
function Computation({ detail: d, month, money }: { detail: Breakdown; month: string; money: Money }) {
  const extra = d.budget - d.minimums;
  const focus = d.lines.find((l) => l.isTarget);
  return (
    <View style={styles.math}>
      <Text style={styles.mathTitle}>Payoff order</Text>
      {d.order.map((o, i) => (
        <View key={o.id} style={styles.mathRow}>
          <Text style={styles.mathName} numberOfLines={1}>
            {i + 1}. {o.name}
          </Text>
          <Text style={styles.mathValue}>{ym(o.payoff)}</Text>
        </View>
      ))}

      <Text style={styles.mathTitle}>This month ({formatYearMonth(month, undefined, 'short')})</Text>
      {d.lines.map((l) => (
        <View key={l.id} style={styles.mathRow}>
          <Text style={[styles.mathName, l.isTarget && styles.focus]} numberOfLines={1}>
            {l.name}
            {l.isTarget ? ' · focus' : ''}
          </Text>
          <Text style={styles.mathValue}>{l.extra > 0 ? `${money(l.minimum)} + ${money(l.extra)}` : money(l.minimum)}</Text>
        </View>
      ))}

      <Text style={styles.mathTitle}>The math</Text>
      <Text style={styles.formula}>
        Extra each month = {money(d.budget)} budget − {money(d.minimums)} minimums = <Text style={styles.strongInk}>{money(Math.max(0, extra))}</Text>
        {focus ? `, all to ${focus.name}` : ''}
      </Text>
      <Text style={styles.formula}>
        Total interest = {d.order.map((o) => money(o.interest)).join(' + ')} = <Text style={styles.strongInk}>{money(d.interest)}</Text>
      </Text>
      <Text style={styles.formula}>
        Last debt paid off in {formatYearMonth(d.debtFree)}, <Text style={styles.strongInk}>{timeUntil(month, d.debtFree)}</Text>
      </Text>
      <Text style={styles.mathNote}>When a debt is paid off, its payment rolls into the next one in the order.</Text>
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
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...type.sectionTitle, color: colors.ink },
  currentChip: { ...type.captionBold, color: colors.onPrimary, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: space.xs, paddingHorizontal: 10, overflow: 'hidden' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexGrow: 1, flexBasis: 90, gap: 2 },
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
  toggle: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  toggleText: { ...type.rowTitleSm, color: colors.primary },
  math: { gap: 6, backgroundColor: colors.bg, borderRadius: radius.card, padding: space.md },
  mathTitle: { ...type.captionBold, color: colors.muted, textTransform: 'uppercase', marginTop: space.xs },
  mathRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  mathName: { ...type.bodySm, color: colors.ink, flexShrink: 1 },
  focus: { ...type.rowTitleSm, color: colors.primary },
  mathValue: { ...type.bodySm, color: colors.inkSoft },
  formula: { ...type.bodySm, color: colors.inkSoft },
  strongInk: { ...type.rowTitleSm, color: colors.ink },
  mathNote: { ...type.caption, color: colors.muted },
});
