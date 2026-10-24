import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppDb } from '@/db/client';
import type { DebtRow, Settings, TransactionRow } from '@/db/schema';
import {
  countdown,
  loadSnapshot,
  monthPlan,
  moneyText,
  paidInMonth,
  payoffDate,
  plannedAmount,
  progress,
  projection,
  shortDate,
  type Snapshot,
} from '@/domain/dashboard';
import { KIND_LABELS, templateById } from '@/domain/debtForm';
import { annualFromMonthly, formatPercent, today } from '@/domain/format';
import { usePaymentSheet } from '@/state/usePaymentSheet';
import { theme } from '@/theme';
import { Button, IconButton } from '@/ui/Button';
import { ProgressBar } from '@/ui/Controls';
import { DebtCard } from '@/ui/DebtCard';
import { BackIcon } from '@/ui/icons';
import { Mascot } from '@/ui/Mascot';

// 09 Debt detail. Edit / archive / delete await approval (design/proposals/debt-edit.md).
export default function DebtDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [snap, setSnap] = useState<(Snapshot & { settings: Settings }) | null>(null);
  const refresh = useCallback(() => {
    getAppDb().then((db) => setSnap(loadSnapshot(db)));
  }, []);
  useFocusEffect(refresh);

  const hide = snap?.settings.hideBalances ?? false;
  const payments = usePaymentSheet(refresh, hide);
  const model = useMemo(() => (snap ? build(snap, id) : null), [snap, id]);

  if (!snap) return null;
  if (!model) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <Text style={[styles.body, styles.padded]}>This debt isn’t here anymore.</Text>
      </SafeAreaView>
    );
  }
  const { debt, txs } = model;
  const money = (n: number) => moneyText(n, debt.currency, hide);
  const pct = Math.round(model.progress.ratio * 100);
  const template = templateById(debt.templateId);

  const logPayment = () =>
    payments.open({
      debtId: debt.id,
      name: debt.nickname,
      currency: debt.currency,
      mode: 'planned',
      planned: model.plannedLeft,
      minimum: model.minimumLeft,
      balance: model.balance,
      hint: model.plannedLeft > 0 ? `Planned this month ${money(model.plannedLeft)}` : 'Nothing more planned this month',
      nextName: null,
    });

  return (
    <SafeAreaView style={styles.screen}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DebtCard
          variant="full"
          color={debt.color}
          nickname={debt.nickname}
          balanceText={money(model.balance)}
          issuer={debt.issuer ?? KIND_LABELS[debt.kind]}
          kindLabel={KIND_LABELS[debt.kind]}
          network={template?.network}
        />

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>
              {money(model.progress.paid)} paid of {money(model.progress.paid + model.progress.remaining)}
            </Text>
            <Text style={styles.small}>{pct}% paid</Text>
          </View>
          <ProgressBar tone="hero" value={model.progress.ratio} accessibilityLabel={`${pct}% paid off`} />
        </View>

        <View style={[styles.card, styles.countdown]}>
          <Mascot mood={hide ? 'hide' : model.payoff ? 'cheer' : 'concern'} size={68} />
          <View style={styles.countdownText}>
            <Text style={styles.big}>{model.payoff?.big ?? (model.balance === 0 ? 'Paid off' : 'No date yet')}</Text>
            <Text style={styles.bodyInk}>{model.payoffText}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Stat label="Interest" value={`${formatPercent(debt.monthlyRate)} / mo · ${formatPercent(annualFromMonthly(debt.monthlyRate))} / yr`} />
          <Stat label={debt.amortizationMinor != null ? 'Monthly payment' : 'Minimum'} value={minimumText(debt, money)} />
          <Stat label="Statement day" value={ordinal(debt.statementDay)} />
          <Stat label="Due day" value={ordinal(debt.dueDay)} />
        </View>

        <View style={styles.actions}>
          {model.balance > 0 ? (
            <View style={styles.action}>
              <Button label="Log a payment" onPress={logPayment} />
            </View>
          ) : null}
          <View style={styles.action}>
            <Button variant="secondary" label="Update balance" onPress={() => router.push({ pathname: '/check-in/[id]', params: { id: debt.id } })} />
          </View>
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            History
          </Text>
          {txs.map((t) => (
            <View key={t.id} style={styles.historyRow} accessible>
              <View style={styles.historyText}>
                <Text style={styles.historyLabel}>{historyLabel(t, txs)}</Text>
                <Text style={styles.caption}>{shortDate(t.occurredOn)}</Text>
              </View>
              <Text style={[styles.amount, t.type !== 'opening' && (t.amountMinor < 0 ? styles.down : styles.up)]}>
                {t.type === 'opening' ? money(t.amountMinor) : `${t.amountMinor < 0 ? '−' : '+'}${money(Math.abs(t.amountMinor))}`}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          Dates and amounts are estimates.{' '}
          <Text accessibilityRole="link" style={styles.link} onPress={() => router.push({ pathname: '/explain', params: { id: debt.id } })}>
            How is this calculated?
          </Text>
        </Text>
      </ScrollView>
      {payments.sheet}
    </SafeAreaView>
  );
}

function build(snap: Snapshot, id: string) {
  const debt = snap.rows.find((r) => r.id === id);
  if (!debt) return null;
  const txs = snap.txs.filter((t) => t.debtId === id);
  const p = progress(txs);
  const plan = monthPlan(snap);
  const line = plan.lines.find((l) => l.debtId === id);
  const paid = paidInMonth(snap.txs, snap.month).get(id)?.planned ?? 0;
  const result = projection(snap);
  const isFocus = plan.focusId === id;

  let payoff: ReturnType<typeof countdown> | null = null;
  let payoffText = 'At this budget there’s no payoff date yet. A higher monthly amount fixes that.';
  if (p.remaining === 0) payoffText = 'Nice work — this one’s done.';
  else if (result.status === 'ok' && result.perDebt[id]) {
    payoff = countdown(today(), payoffDate(result.perDebt[id].payoff, debt.dueDay));
    payoffText = payoff.inDays
      ? `until ${debt.nickname} is paid off — ${payoff.sub}.`
      : `${debt.nickname} paid off ${payoff.sub}.`;
    if (isFocus) payoffText += ' It’s your focus debt.';
  }

  return {
    debt,
    // Newest first, as listTransactions returns them.
    txs,
    progress: p,
    balance: p.remaining,
    payoff,
    payoffText,
    plannedLeft: Math.max(0, (line ? plannedAmount(line) : 0) - paid),
    minimumLeft: Math.max(0, (line?.minimumDue ?? 0) - paid),
  };
}

function Header() {
  return (
    <View style={styles.header}>
      <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
        <BackIcon size={24} color={colors.ink} />
      </IconButton>
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

function minimumText(d: DebtRow, money: (n: number) => string): string {
  if (d.amortizationMinor != null) return money(d.amortizationMinor);
  if (d.minRule === 'fixed' && d.minFixedMinor != null) return money(d.minFixedMinor);
  if (d.minRule === 'percent' && d.minPercent) return `${formatPercent(d.minPercent)} of balance`;
  if (d.minRule === 'percent_or_fixed' && d.minPercent && d.minFixedMinor != null) {
    return `${formatPercent(d.minPercent)} or ${money(d.minFixedMinor)}`;
  }
  return '—';
}

function ordinal(day: number | null): string {
  if (!day) return '—';
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th';
  return `${day}${suffix}`;
}

const HISTORY_LABELS: Record<TransactionRow['type'], string> = {
  opening: 'Starting balance',
  payment: 'Payment',
  charge: 'New charges',
  interest_fee: 'Statement update · interest',
  statement_adjustment: 'Statement update',
  correction: 'Correction',
  reversal: 'Undone',
};

function historyLabel(t: TransactionRow, txs: TransactionRow[]): string {
  if (t.type === 'payment' && t.isExtra) return 'Extra payment';
  if (t.type === 'reversal') {
    const orig = txs.find((o) => o.id === t.reversesId);
    return orig?.type === 'payment' ? 'Payment undone' : HISTORY_LABELS.reversal;
  }
  return HISTORY_LABELS[t.type];
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: space.sm },
  padded: { paddingHorizontal: space.screenApp },
  content: { paddingHorizontal: space.screenApp, paddingTop: space.xs, paddingBottom: space.xl, gap: space.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.cardLg - 2, padding: 18, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm },
  rowTitle: { ...type.rowTitleSm, color: colors.ink, flexShrink: 1 },
  small: { ...type.small, color: colors.muted },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  countdownText: { flex: 1, gap: 2 },
  big: { ...type.amountSm, color: colors.primary },
  body: { ...type.body, color: colors.muted },
  bodyInk: { ...type.bodySm, color: colors.inkSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: space.xs },
  statValue: { ...type.miniBalance, color: colors.ink },
  caption: { ...type.caption, color: colors.muted },
  sectionTitle: { ...type.sectionTitle, color: colors.ink },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderTopWidth: 1, borderTopColor: colors.divider, gap: space.sm },
  historyText: { gap: 2, flexShrink: 1 },
  historyLabel: { ...type.input, color: colors.ink },
  amount: { ...type.rowTitle, color: colors.ink },
  down: { color: colors.primary },
  up: { color: colors.accentLabel },
  footnote: { ...type.caption, color: colors.muted, textAlign: 'center' },
  link: { ...type.captionBold, color: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: { flex: 1 },
});
