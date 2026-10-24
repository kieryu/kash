import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getAppDb } from '@/db/client';
import type { Settings } from '@/db/schema';
import { balancesOf, budgetOf, loadSnapshot, monthPlan, projection, type Snapshot } from '@/domain/dashboard';
import { toEngineDebts } from '@/domain/engineDebts';
import { explainRows } from '@/domain/explain';
import { formatMoney, formatYearMonth } from '@/domain/format';
import { theme } from '@/theme';
import { BackScreen, Note } from '@/ui/Backup';

const NAMES: Record<Settings['strategy'], string> = { snowball: 'Snowball', avalanche: 'Avalanche', custom: 'My own order' };

// "How was this calculated?" (§7): this month's numbers per debt, from explainLine. `id` narrows to one debt.
export default function Explain() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [snap, setSnap] = useState<(Snapshot & { settings: Settings }) | null>(null);
  useEffect(() => {
    getAppDb().then((db) => setSnap(loadSnapshot(db)));
  }, []);
  if (!snap) return null;

  const s = snap.settings;
  const money = (n: number) => formatMoney(n, s.homeCurrency);
  const plan = monthPlan(snap);
  const result = projection(snap);
  const debts = new Map(toEngineDebts(snap.rows, balancesOf(snap.txs)).map((d) => [d.id, d]));
  const names = new Map(snap.rows.map((r) => [r.id, r.nickname]));
  const lines = plan.lines.filter((l) => !id || l.debtId === id);
  const end =
    result.status === 'ok'
      ? `That lands on ${formatYearMonth(result.debtFree)}, with about ${money(result.totals.interest)} in total interest.`
      : 'At this budget the plan doesn’t reach zero yet, so there’s no debt-free date.';

  return (
    <BackScreen title="How it’s calculated" onBack={() => router.back()}>
      <Note>These are estimates. Real statements can differ: banks use daily balances, and fees or new purchases change the numbers.</Note>
      {s.hideBalances ? (
        <Text style={styles.body}>Balances are hidden. Turn off “Hide” on the dashboard to see the numbers.</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Your debt-free date
            </Text>
            <Text style={styles.body}>
              Each month Kash pays the minimum on every debt, then puts the rest of your {money(budgetOf(snap))} budget on the focus debt (
              {NAMES[s.strategy]}). When a debt is paid off, its payment rolls to the next one. Kash repeats this month by month until every
              balance is zero. {end}
            </Text>
          </View>
          {lines.map((line) => (
            <View key={line.debtId} style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                {names.get(line.debtId)} · {formatYearMonth(snap.month)}
              </Text>
              {explainRows(debts.get(line.debtId)!, line).map((r) => (
                <View key={r.label} style={styles.row} accessible>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowLabel}>{r.label}</Text>
                    <Text style={styles.rowResult}>{r.result}</Text>
                  </View>
                  <Text style={styles.formula}>{r.formula}</Text>
                </View>
              ))}
            </View>
          ))}
          {lines.length === 0 ? <Text style={styles.body}>Nothing is planned this month.</Text> : null}
        </>
      )}
      <Text style={styles.footnote}>Estimates only. Not financial advice.</Text>
    </BackScreen>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  body: { ...type.body, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.cardLg - 2, padding: 18, gap: 10 },
  cardTitle: { ...type.sectionTitle, color: colors.ink },
  row: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, gap: 2 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  rowLabel: { ...type.rowTitleSm, color: colors.ink, flexShrink: 1 },
  rowResult: { ...type.rowTitleSm, color: colors.ink },
  formula: { ...type.small, color: colors.muted },
  footnote: { ...type.caption, color: colors.muted, textAlign: 'center' },
});
