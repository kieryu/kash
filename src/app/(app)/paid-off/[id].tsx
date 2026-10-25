import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppDb } from '@/db/client';
import { getDebt } from '@/db/repositories/debts';
import type { DebtRow } from '@/db/schema';
import { loadSnapshot, moneyText, paidOffSummary } from '@/domain/dashboard';
import { formatYearMonth, today } from '@/domain/format';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';

type Data = { debt: DebtRow; sum: ReturnType<typeof paidOffSummary>; hide: boolean; currency: string };

// Debt paid-off moment (design/proposals/paid-off.md). Opened once per debt, right after the save that cleared it.
export default function PaidOff() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    getAppDb().then((db) => {
      const debt = getDebt(db, id);
      if (!debt) return router.replace('/');
      const snap = loadSnapshot(db);
      setData({ debt, sum: paidOffSummary(snap, id, today()), hide: snap.settings.hideBalances, currency: snap.settings.homeCurrency });
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [id]);
  if (!data) return null;

  const { debt, sum, hide } = data;
  const home = () => router.dismissTo('/');
  const stats = [
    { label: 'Paid off', value: formatYearMonth((debt.paidOffOn ?? today()).slice(0, 7), undefined, 'short') },
    { label: 'Debts left', value: String(sum.debtsLeft) },
    { label: 'Total paid', value: moneyText(sum.totalPaid, data.currency, hide) },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false}>
        <Mascot mood="cheer" size={160} />
        <Text accessibilityRole="header" style={styles.title}>
          {sum.isLast ? 'You’re debt-free!' : `${debt.nickname} is paid off!`}
        </Text>
        <Text style={styles.body}>That’s {moneyText(sum.paidOnThis, debt.currency, hide)} paid on this one since you started.</Text>

        {!sum.isLast && (sum.nextName || sum.debtFree) ? (
          <View style={styles.card} accessible>
            {sum.nextName ? (
              <Text style={styles.cardText}>
                Your extra money now goes to <Text style={styles.cardBold}>{sum.nextName}</Text>
              </Text>
            ) : null}
            {sum.debtFree ? (
              <Text style={styles.cardSub}>{sum.debtFree.inDays ? `Debt-free in ${sum.debtFree.big}` : `Debt-free by ${sum.debtFree.big}`}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button variant="accent" label={sum.isLast ? 'See what I did' : 'Keep going'} onPress={home} />
        {/* Paid-off debts already move to the Debts tab's "Paid off" section (proposal footnote). */}
        <Button variant="link" color={colors.onPrimary} label="Keep this card in my wallet" onPress={() => router.dismissTo('/wallet')} />
      </View>
    </SafeAreaView>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary, paddingHorizontal: 28, paddingBottom: space.xxl },
  center: { flexGrow: 1, paddingVertical: space.lg, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  title: { ...type.h1, color: colors.onPrimary, textAlign: 'center' },
  body: { ...type.body, color: colors.onPrimaryMuted, textAlign: 'center' },
  card: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg, gap: space.xs },
  cardText: { ...type.body, color: colors.ink },
  cardBold: { ...type.rowTitle, color: colors.ink },
  cardSub: { ...type.small, color: colors.muted },
  stats: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm },
  stat: { flexGrow: 1, flexBasis: 0, minWidth: 90, alignItems: 'center', gap: 2 },
  statValue: { ...type.rowTitle, color: colors.onPrimary, textAlign: 'center' },
  statLabel: { ...type.caption, color: colors.onPrimaryMuted, textAlign: 'center' },
  footer: { gap: space.sm, alignItems: 'stretch' },
});
