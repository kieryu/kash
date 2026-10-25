import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppDb } from '@/db/client';
import { STRATEGY_NAMES } from '@/domain/compare';
import { countdown, debtFreeDate, debtsList, loadSnapshot, moneyText, plannedAmount, planMonths, projection, type LoadedSnapshot } from '@/domain/dashboard';
import { formatYearMonth, today } from '@/domain/format';
import { theme } from '@/theme';
import { ChevronIcon } from '@/ui/icons';

const FIRST_MONTHS = 12;

// Plan tab (design/proposals/plan-tab.md): payoff order + month table, same projection as the dashboard. No charts in MVP.
export default function Plan() {
  const [snap, setSnap] = useState<LoadedSnapshot | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  useFocusEffect(
    useCallback(() => {
      getAppDb().then((db) => setSnap(loadSnapshot(db)));
    }, []),
  );
  const model = useMemo(() => {
    if (!snap) return null;
    const result = projection(snap);
    return { result, list: debtsList(snap, today()), months: planMonths(result) };
  }, [snap]);
  if (!snap || !model) return null;

  const { result, list, months } = model;
  const hide = snap.settings.hideBalances;
  const money = (n: number) => moneyText(n, snap.settings.homeCurrency, hide);
  const names = new Map(snap.rows.map((r) => [r.id, r]));
  const shown = all ? months : months.slice(0, FIRST_MONTHS);
  const toggle = (m: string) => {
    const next = new Set(open);
    if (!next.delete(m)) next.add(m);
    setOpen(next);
  };

  let summary: [string, string];
  if (list.active.length === 0) summary = [snap.rows.length ? 'Debt-free!' : 'No debts yet', snap.rows.length ? 'Every balance is at zero.' : 'Add a debt to see your plan.'];
  else if (result.status === 'ok') {
    const c = countdown(today(), debtFreeDate(snap.rows, result));
    summary = [c.inDays ? `Debt-free in ${c.big}` : `Debt-free by ${c.big}`, `Total interest ≈ ${money(result.totals.interest)} · estimate`];
  } else if (result.status === 'shortfall') summary = ['No debt-free date yet', `Your minimums are ${money(result.shortBy)} more than your budget.`];
  else summary = ['No debt-free date yet', 'At this budget, interest outpaces payments. A higher monthly amount gets you a date.'];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Your plan
        </Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/compare')} style={styles.linkHit}>
          <Text style={styles.link}>Compare strategies</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero} accessible>
          <Text style={styles.heroSmall}>{STRATEGY_NAMES[snap.settings.strategy]}</Text>
          <Text style={styles.heroBig}>{summary[0]}</Text>
          <Text style={styles.heroSmall}>{summary[1]}</Text>
        </View>

        {list.active.length > 0 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Payoff order
            </Text>
            {list.active.map((i, n) => (
              <Pressable
                key={i.debt.id}
                accessibilityRole="button"
                accessibilityLabel={`${n + 1}. ${i.debt.nickname}${i.isFocus ? ', focus debt' : ''}, ${i.payoffText}`}
                onPress={() => router.push({ pathname: '/debt/[id]', params: { id: i.debt.id } })}
                style={({ pressed }) => [styles.orderRow, i.isFocus && styles.focus, pressed && styles.pressed]}
              >
                <Text style={styles.orderNum}>{n + 1}</Text>
                <View style={[styles.bar, { backgroundColor: i.debt.color }]} />
                <View style={styles.grow}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {i.debt.nickname}
                  </Text>
                  <Text style={styles.caption}>{i.payoffText}</Text>
                </View>
                {i.isFocus ? <Text style={styles.focusChip}>FOCUS</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {months.length > 0 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Month by month
            </Text>
            <View style={styles.card}>
              {shown.map((m) => {
                const expanded = open.has(m.month);
                return (
                  <View key={m.month} style={styles.monthRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      accessibilityLabel={`${formatYearMonth(m.month)}, ${money(m.paid)} paid, ${money(m.left)} left`}
                      onPress={() => toggle(m.month)}
                      style={({ pressed }) => [styles.monthHead, pressed && styles.pressed]}
                    >
                      <Text style={[styles.rowTitle, styles.grow]}>{formatYearMonth(m.month, undefined, 'short')}</Text>
                      <View style={styles.right}>
                        <Text style={styles.rowTitle}>{money(m.paid)}</Text>
                        <Text style={styles.caption}>{money(m.left)} left</Text>
                      </View>
                      <View style={expanded ? styles.chevronOpen : styles.chevron}>
                        <ChevronIcon size={18} color={colors.muted} />
                      </View>
                    </Pressable>
                    {expanded ? (
                      <View style={styles.lines}>
                        {m.lines
                          .filter((l) => l.opening > 0)
                          .map((l) => (
                            <View key={l.debtId} style={styles.line} accessible>
                              <Text style={styles.label}>{names.get(l.debtId)?.nickname}</Text>
                              <Text style={styles.caption}>
                                Pay {money(plannedAmount(l))} · interest {money(l.interest)} · ends at {money(l.closing)}
                              </Text>
                            </View>
                          ))}
                        <Text
                          accessibilityRole="link"
                          style={styles.footLink}
                          onPress={() => router.push({ pathname: '/explain', params: { month: m.month } })}
                        >
                          How was this calculated?
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
            {months.length > FIRST_MONTHS ? (
              <Pressable accessibilityRole="button" onPress={() => setAll(!all)} style={styles.linkHit}>
                <Text style={styles.link}>{all ? 'Show fewer' : `Show all ${months.length} months`}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.footnote}>Estimates only. Real statements may differ.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const { colors, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.screenApp, paddingTop: space.md, paddingBottom: space.sm },
  title: { ...type.screenHeader, color: colors.ink },
  link: { ...type.label, color: colors.primary },
  linkHit: { minHeight: size.hitTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.85 },
  content: { paddingHorizontal: space.screenApp, paddingTop: space.sm, paddingBottom: space.xl, gap: space.lg },
  hero: { backgroundColor: colors.primary, borderRadius: radius.cardLg, padding: 18, gap: space.xs },
  heroSmall: { ...type.small, color: colors.onPrimaryMuted },
  heroBig: { ...type.hero, color: colors.onPrimary },
  section: { gap: 10 },
  sectionTitle: { ...type.sectionTitle, color: colors.ink },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: space.sm,
  },
  focus: { borderColor: colors.accent },
  orderNum: { ...type.label, color: colors.muted, minWidth: 16, textAlign: 'center' },
  bar: { width: size.colorBar, height: 32, borderRadius: 4 },
  grow: { flex: 1, gap: 2 },
  rowTitle: { ...type.rowTitleSm, color: colors.ink },
  caption: { ...type.caption, color: colors.muted },
  label: { ...type.label, color: colors.ink },
  focusChip: { ...type.microBold, color: colors.proChipText, backgroundColor: colors.proChipBg, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: space.sm, overflow: 'hidden' },
  card: { backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: space.lg },
  monthRow: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56 },
  right: { alignItems: 'flex-end', gap: 2 },
  chevron: { transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  lines: { gap: space.sm, paddingBottom: space.md },
  line: { gap: 2 },
  footLink: { ...type.captionBold, color: colors.primary, paddingVertical: space.xs },
  footnote: { ...type.caption, color: colors.muted, textAlign: 'center' },
});
