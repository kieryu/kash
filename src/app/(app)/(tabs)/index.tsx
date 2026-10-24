import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { updateSettings } from '@/db/repositories/settings';
import type { DebtRow, Settings } from '@/db/schema';
import {
  balancesOf,
  countdown,
  debtFreeDate,
  dueText,
  loadSnapshot,
  monthPlan,
  moneyText,
  movement,
  movementText,
  nextDueDate,
  paidInMonth,
  plannedAmount,
  progress,
  projection,
  type Snapshot,
} from '@/domain/dashboard';
import { formatYearMonth, today } from '@/domain/format';
import { paidText, type SheetTarget } from '@/domain/payments';
import { usePaymentSheet } from '@/state/usePaymentSheet';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/Controls';
import { DebtCard } from '@/ui/DebtCard';
import { EyeIcon, PlusIcon } from '@/ui/icons';
import { Mascot, type MascotMood } from '@/ui/Mascot';
import { FocusDebtCard, PaymentRow } from '@/ui/Payments';

const STRATEGY_NAMES: Record<Settings['strategy'], string> = { snowball: 'Snowball', avalanche: 'Avalanche', custom: 'My own order' };

// 08 Dashboard. Every number is derived from stored rows on focus (D12).
export default function Dashboard() {
  const [snap, setSnap] = useState<(Snapshot & { settings: Settings }) | null>(null);
  const refresh = useCallback(() => {
    getAppDb().then((db) => setSnap(loadSnapshot(db)));
  }, []);
  useFocusEffect(refresh);

  const hide = snap?.settings.hideBalances ?? false;
  const payments = usePaymentSheet(refresh, hide);
  const model = useMemo(() => (snap ? build(snap) : null), [snap]);

  if (!snap || !model) return null;
  const currency = snap.settings.homeCurrency;
  const money = (n: number) => moneyText(n, currency, hide);
  const day = today();

  const toggleHide = async () => {
    updateSettings(await getAppDb(), { hideBalances: !hide });
    refresh();
  };

  const target = (d: DebtRow, mode: SheetTarget['mode'], planned: number, minimum: number, hint: string): SheetTarget => ({
    debtId: d.id,
    name: d.nickname,
    currency: d.currency,
    mode,
    planned,
    minimum,
    balance: Math.max(0, model.balances.get(d.id) ?? 0),
    hint,
    nextName: model.nextName(d.id),
  });

  const focus = model.focus;
  const mood: MascotMood = hide ? 'hide' : model.concern ? 'concern' : model.movementUp ? 'cheer' : 'watch';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>{APP_NAME}</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Hide balances"
          accessibilityState={{ checked: hide }}
          onPress={toggleHide}
          style={({ pressed }) => [styles.hideButton, pressed && styles.pressed]}
        >
          <EyeIcon size={18} color={colors.primary} />
          <Text style={styles.hideText}>{hide ? 'Show' : 'Hide'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero snap={snap} model={model} money={money} mood={mood} />

        {snap.rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.body}>No debts here yet. Add one to see your plan.</Text>
            <Button label="Add a debt" onPress={() => router.push('/debt-form')} />
          </View>
        ) : null}

        {model.plan.lines.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {monthName(snap.month)} payments
              </Text>
              <Text style={styles.small}>
                {model.paidCount} of {model.plan.lines.length} paid · {money(model.plannedTotal)}
              </Text>
            </View>

            {model.plan.shortfall ? (
              <Text style={styles.warn}>
                Your minimums add up to {money(model.plan.shortfall.minimumsTotal)}, which is {money(model.plan.shortfall.shortBy)} more than
                your monthly budget. Pay the minimums first to avoid late fees.
              </Text>
            ) : null}

            {focus ? (
              <FocusDebtCard
                color={focus.debt.color}
                name={focus.debt.nickname}
                dueText={dueText(nextDueDate(focus.debt.dueDay, day), day, true)}
                amountText={money(focus.planned)}
                splitText={hide ? 'minimum + extra' : `${money(focus.line.paidMinimum)} min + ${money(focus.line.paidExtra)} extra`}
                paidText={focus.paid > 0 ? paidText(focus.paid, focus.planned, money) : null}
                onLog={() =>
                  payments.open(
                    target(
                      focus.debt,
                      'planned',
                      focus.planned,
                      focus.line.minimumDue,
                      hide ? 'Planned: minimum + extra' : `Planned ${money(focus.planned)} · ${money(focus.line.paidMinimum)} minimum + ${money(focus.line.paidExtra)} extra`,
                    ),
                  )
                }
                onUndo={() => payments.undo(focus.debt.id)}
              />
            ) : null}

            {model.rows.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Minimum payments</Text>
                {model.rows.map((r) => (
                  <PaymentRow
                    key={r.debt.id}
                    color={r.debt.color}
                    name={r.debt.nickname}
                    sub={r.paid > 0 ? `Paid ${money(r.paid)} · logged` : `${dueText(nextDueDate(r.debt.dueDay, day), day)} · ${money(r.planned)}`}
                    status={r.paid > 0 ? 'paid' : r.debt.autoDeducted ? 'auto' : 'due'}
                    onLog={() => payments.open(target(r.debt, 'planned', r.planned, r.line.minimumDue, `Minimum due ${money(r.line.minimumDue)}`))}
                    onUndo={() => payments.undo(r.debt.id)}
                  />
                ))}
              </View>
            ) : null}

            {focus ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => payments.open(target(focus.debt, 'extra', 0, 0, `Goes to your focus debt: ${focus.debt.nickname}`))}
                style={({ pressed }) => [styles.extra, pressed && styles.pressed]}
              >
                <View style={styles.extraIcon}>
                  <PlusIcon size={18} color={colors.accentLabel} />
                </View>
                <View style={styles.extraText}>
                  <Text style={styles.rowTitle}>Log an extra payment</Text>
                  <Text style={styles.caption}>Bonus, 13th month pay, side income</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {snap.rows.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Your debts
              </Text>
              <Text accessibilityRole="link" style={styles.link} onPress={() => router.push('/compare')}>
                Compare strategies
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {snap.rows.map((d) => (
                <DebtCard
                  key={d.id}
                  variant="mini"
                  color={d.color}
                  nickname={d.nickname}
                  balanceText={moneyText(Math.max(0, model.balances.get(d.id) ?? 0), d.currency, hide)}
                  progress={progress(snap.txs.filter((t) => t.debtId === d.id)).ratio}
                  onPress={() => router.push({ pathname: '/debt/[id]', params: { id: d.id } })}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {model.plan.lines.length > 0 ? (
          <Text style={styles.footnote}>
            Interest this month ≈ {money(model.interest)} · estimate ·{' '}
            <Text accessibilityRole="link" style={styles.footLink} onPress={() => router.push('/explain')}>
              How is this calculated?
            </Text>
          </Text>
        ) : null}
      </ScrollView>
      {payments.sheet}
    </SafeAreaView>
  );
}

type Model = ReturnType<typeof build>;

function build(snap: Snapshot) {
  const plan = monthPlan(snap);
  const paid = paidInMonth(snap.txs, snap.month);
  const byId = new Map(snap.rows.map((r) => [r.id, r]));
  const items = plan.lines.map((line) => ({
    debt: byId.get(line.debtId)!,
    line,
    planned: plannedAmount(line),
    paid: paid.get(line.debtId)?.planned ?? 0,
  }));
  const focus = items.find((i) => i.debt.id === plan.focusId) ?? null;
  const result = projection(snap);
  const move = movement(snap);
  return {
    plan,
    focus,
    rows: items.filter((i) => i !== focus),
    paidCount: items.filter((i) => i.paid > 0).length,
    plannedTotal: items.reduce((s, i) => s + i.planned, 0),
    interest: plan.lines.reduce((s, l) => s + l.interest, 0),
    balances: balancesOf(snap.txs),
    progress: progress(snap.txs),
    result,
    move,
    movementUp: (move?.months ?? 0) > 0,
    concern: plan.shortfall !== null || result.status !== 'ok',
    nextName: (id: string) => (id === plan.focusId && plan.nextFocusId ? (byId.get(plan.nextFocusId)?.nickname ?? null) : null),
  };
}

function Hero({ snap, model, money, mood }: { snap: Snapshot; model: Model; money: (n: number) => string; mood: MascotMood }) {
  const p = model.progress;
  const strategy = STRATEGY_NAMES[snap.settings.strategy];
  let lines: [string, string, string];
  if (snap.rows.length > 0 && p.remaining === 0) lines = ['You did it', 'Debt-free!', 'Every balance is at zero.'];
  else if (model.result.status === 'ok') {
    const c = countdown(today(), debtFreeDate(snap.rows, model.result));
    lines = c.inDays ? ['Debt-free in', c.big, `${c.sub} · ${strategy}`] : ['Debt-free by', c.big, `${c.sub} · ${strategy}`];
  } else if (model.result.status === 'shortfall') {
    lines = ['Your minimums are more than your budget', `by ${money(model.result.shortBy)}`, `Starting ${formatYearMonth(model.result.month)}`];
  } else lines = ['At this budget', 'interest outpaces payments', 'A higher monthly amount gets you a debt-free date.'];
  const text = movementText(model.move, money);
  const pct = Math.round(p.ratio * 100);

  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroText} accessible accessibilityLabel={lines.join(' ')}>
          <Text style={styles.heroSmall}>{lines[0]}</Text>
          <Text style={styles.heroBig}>{lines[1]}</Text>
          <Text style={styles.heroSmall}>{lines[2]}</Text>
        </View>
        <Mascot mood={mood} size={68} />
      </View>
      <View style={styles.heroProgress}>
        <ProgressBar tone="hero" value={p.ratio} accessibilityLabel={`${pct}% paid off`} />
        <View style={styles.heroRow}>
          <Text style={styles.heroCaption}>
            {money(p.paid)} paid · {pct}%
          </Text>
          <Text style={styles.heroCaption}>{money(p.remaining)} left</Text>
        </View>
      </View>
      {text ? (
        <Text style={styles.movement} accessibilityLiveRegion="polite">
          {text}
        </Text>
      ) : null}
    </View>
  );
}

function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1));
}

const { colors, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.screenApp, paddingTop: space.md, paddingBottom: space.sm },
  wordmark: { ...type.screenHeader, color: colors.primary },
  hideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: size.hitTarget,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: size.border,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  hideText: { ...type.label, color: colors.primary },
  pressed: { opacity: 0.85 },
  content: { paddingHorizontal: space.screenApp, paddingTop: space.sm, paddingBottom: space.xl, gap: space.lg },

  hero: { backgroundColor: colors.primary, borderRadius: radius.cardLg, padding: 18, gap: space.md },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm },
  heroText: { flex: 1, gap: space.xs },
  heroSmall: { ...type.small, color: colors.onPrimaryMuted },
  heroBig: { ...type.hero, color: colors.onPrimary },
  heroProgress: { gap: 6 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroCaption: { ...type.caption, color: colors.onPrimaryMuted },
  movement: {
    ...type.captionBold,
    alignSelf: 'flex-start',
    color: colors.onAccent,
    backgroundColor: colors.movementChip,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },

  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm },
  sectionTitle: { ...type.sectionTitle, color: colors.ink },
  small: { ...type.small, color: colors.muted },
  body: { ...type.body, color: colors.muted },
  warn: { ...type.bodySm, color: colors.accentText, backgroundColor: colors.accentSoft, borderRadius: radius.input, padding: space.md, overflow: 'hidden' },
  card: { backgroundColor: colors.surface, borderRadius: 18, paddingVertical: space.xs, paddingHorizontal: space.lg },
  cardLabel: { ...type.captionBold, color: colors.muted, paddingTop: 10, paddingBottom: space.xs },
  extra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: size.border,
    borderStyle: 'dashed',
    borderColor: colors.dashedLine,
    borderRadius: radius.card,
    paddingVertical: space.md,
    paddingHorizontal: 14,
  },
  extraIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  extraText: { gap: 2, flexShrink: 1 },
  rowTitle: { ...type.rowTitleSm, color: colors.ink },
  caption: { ...type.caption, color: colors.muted },
  carousel: { gap: 10 },
  footnote: { ...type.caption, color: colors.muted, textAlign: 'center' },
  link: { ...type.label, color: colors.primary },
  footLink: { ...type.captionBold, color: colors.primary },
  empty: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg, gap: space.md },
});
