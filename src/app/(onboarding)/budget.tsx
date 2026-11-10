import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { getAppDb } from '@/db/client';
import { listDebts } from '@/db/repositories/debts';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { balances } from '@/db/repositories/transactions';
import type { Settings } from '@/db/schema';
import { currencySymbol } from '@/domain/dashboard';
import { currentYearMonth, formatMoney, formatYearMonth, monthsBetween, parseMoney, timeUntil } from '@/domain/format';
import { amountInputText } from '@/domain/payments';
import { budgetRange, budgetStep, budgetStepTo, minimumsFloor, planInput } from '@/domain/plan';
import { simulate } from '@/engine/simulate';
import { requestReminderPermission } from '@/notifications/reminders';
import type { PlanInput, PlanResult } from '@/engine/types';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { useMoneyInput } from '@/ui/Controls';
import { Mascot } from '@/ui/Mascot';
import { OnboardingScreen } from '@/ui/Onboarding';
import { Slider } from '@/ui/Slider';

const STRATEGY_NAMES: Record<Settings['strategy'], string> = { snowball: 'Snowball', avalanche: 'Avalanche', custom: 'My own order' };

type Loaded = { base: PlanInput; strategy: Settings['strategy']; floor: number; step: number; min: number; max: number };

// 07 Monthly budget. Runs the payoff engine live as the amount changes.
// `?edit=1`: reopened from Settings or the dashboard to change the budget after onboarding.
export default function Budget() {
  const editing = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const [data, setData] = useState<Loaded | null>(null);
  const [budget, setBudget] = useState(0);
  // What the amount field shows; follows −/+ and the slider, or whatever the user types (R22).
  const [text, setText] = useState('');

  useEffect(() => {
    getAppDb().then((db) => {
      const s = getSettings(db);
      const base = planInput(listDebts(db), balances(db), s, 0, currentYearMonth());
      const floor = minimumsFloor(base.debts);
      const step = budgetStep(s.homeCurrency);
      const range = budgetRange(floor, step, s.budgetMinor);
      setData({ base, strategy: s.strategy, floor, step, min: range.min, max: range.max });
      setBudget(range.start);
      setText(amountInputText(range.start, base.currency));
    });
  }, []);

  const plan = useMemo(() => (data ? simulate({ ...data.base, budget }) : null), [data, budget]);
  const faster = useMemo(() => (data ? simulate({ ...data.base, budget: budget + 2 * data.step }) : null), [data, budget]);

  if (!data || !plan || !faster) return null;
  const money = (n: number) => formatMoney(n, data.base.currency);
  const setAmount = (n: number) => {
    setBudget(n);
    setText(amountInputText(n, data.base.currency));
  };
  const typed = (t: string) => {
    setText(t);
    setBudget(parseMoney(t, data.base.currency) ?? 0);
  };
  const tooLow = budget < data.floor;

  const finish = async () => {
    if (editing) {
      updateSettings(await getAppDb(), { budgetMinor: budget });
      return router.back();
    }
    updateSettings(await getAppDb(), { budgetMinor: budget, planStartMonth: data.base.start, onboardingDone: true });
    // Ask here: the plan is set, so due-date and statement reminders make sense. The app layout schedules them.
    await requestReminderPermission().catch(() => false);
    router.dismissAll();
    router.replace('/');
  };

  return (
    <OnboardingScreen
      step={editing ? undefined : 5}
      title={editing ? 'Change your monthly budget' : 'How much can you pay each month?'}
      body={
        <>
          Your minimums add up to <Text style={styles.strong}>{money(data.floor)}</Text>. Anything above that speeds up your plan.
        </>
      }
      footer={
        <>
          <Text style={styles.estimate}>Estimate only — real statements may differ.</Text>
          <Button label={editing ? 'Save budget' : 'See my plan'} onPress={finish} disabled={tooLow} />
        </>
      }
    >
      <View style={styles.card}>
        <View style={styles.amountRow}>
          <Stepper label="−" a11y={`Lower to the next ${money(data.step)}`} onPress={() => setAmount(budgetStepTo(budget, -1, data.step, data.floor))} />
          <AmountInput text={text} currency={data.base.currency} onChange={typed} />
          <Stepper label="+" a11y={`Raise to the next ${money(data.step)}`} onPress={() => setAmount(budgetStepTo(budget, 1, data.step, data.floor))} />
        </View>
        <Slider
          value={budget}
          min={data.min}
          max={Math.max(data.max, budget)}
          step={data.step / 5}
          onChange={setAmount}
          accessibilityLabel="Monthly payoff budget"
          valueText={money(budget)}
        />
        <View style={styles.rangeRow}>
          <Text style={styles.caption}>{money(data.min)} minimum</Text>
          <Text style={styles.caption}>{money(data.max)}</Text>
        </View>
        {tooLow ? (
          <Text style={styles.tooLow} accessibilityLiveRegion="polite">
            Your minimums add up to {money(data.floor)}. Your budget needs to cover at least that.
          </Text>
        ) : null}
      </View>

      <Hero plan={plan} start={data.base.start} strategy={STRATEGY_NAMES[data.strategy]} money={money} />

      <View style={styles.nudge}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.accentLabel} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 19V5M5 12l7-7 7 7" />
        </Svg>
        <Text style={styles.nudgeText}>{nudge(plan, faster, money(2 * data.step))}</Text>
      </View>
    </OnboardingScreen>
  );
}

function nudge(plan: PlanResult, faster: PlanResult, extra: string): string {
  if (plan.status !== 'ok') return `Try a higher amount — even ${extra} more a month makes a difference.`;
  const sooner = faster.status === 'ok' ? monthsBetween(faster.debtFree, plan.debtFree) : 0;
  if (sooner <= 0) return 'You’re already paying a strong amount. Nice.';
  return `Add ${extra} more a month and you’re free ${sooner} ${sooner === 1 ? 'month' : 'months'} sooner.`;
}

function Hero({ plan, start, strategy, money }: { plan: PlanResult; start: string; strategy: string; money: (n: number) => string }) {
  const ok = plan.status === 'ok';
  const lines = ok
    ? ['You’ll be debt-free by', formatYearMonth(plan.debtFree), `${timeUntil(start, plan.debtFree)} · ${strategy}`]
    : plan.status === 'shortfall'
      ? ['Your minimums grow past this amount', `in ${formatYearMonth(plan.month)}`, `Add about ${money(plan.shortBy)} a month to keep up.`]
      : ['At this amount', 'interest outpaces payments', 'Raise the amount to see your debt-free date.'];
  return (
    <View style={styles.hero} accessible accessibilityLabel={lines.join(' ')}>
      <View style={styles.heroText}>
        <Text style={styles.heroSmall}>{lines[0]}</Text>
        <Text style={styles.heroBig}>{lines[1]}</Text>
        <Text style={styles.heroSub}>{lines[2]}</Text>
      </View>
      <Mascot mood={ok ? 'cheer' : 'concern'} size={84} />
    </View>
  );
}

/** The big amount: tap to type any amount (R22). */
function AmountInput({ text, currency, onChange }: { text: string; currency: string; onChange: (t: string) => void }) {
  return (
    <View style={styles.amountBox}>
      <Text style={styles.amount}>{currencySymbol(currency)}</Text>
      <TextInput
        accessibilityLabel="Monthly payoff budget amount"
        accessibilityHint="Type an amount, or use minus, plus and the slider"
        style={[styles.amount, styles.amountInput]}
        selectTextOnFocus
        {...useMoneyInput(text, currency, onChange)}
      />
    </View>
  );
}

function Stepper({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={({ pressed }) => [styles.stepper, pressed && styles.pressed]}>
      <Text style={styles.stepperText}>{label}</Text>
    </Pressable>
  );
}

const { colors, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  strong: { ...type.rowTitle, color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: radius.cardLg - 2, padding: space.xl, gap: space.lg },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 1, borderBottomWidth: size.border, borderBottomColor: colors.lineStrong },
  amount: { ...type.amountLg, color: colors.ink },
  amountInput: { flexShrink: 1, minWidth: 40, padding: 0 },
  tooLow: { ...type.small, color: colors.accentText },
  stepper: {
    minWidth: size.input,
    minHeight: size.input,
    borderRadius: radius.inputLg,
    borderWidth: size.border,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { ...type.amountInput, color: colors.primary },
  pressed: { opacity: 0.85 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm },
  caption: { ...type.caption, color: colors.muted },
  hero: { backgroundColor: colors.primary, borderRadius: radius.cardLg - 2, padding: space.xl, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroText: { flex: 1, gap: space.xs },
  heroSmall: { ...type.small, color: colors.onPrimaryMuted },
  heroBig: { ...type.title, color: colors.onPrimary },
  heroSub: { ...type.bodySm, color: colors.onPrimaryMuted },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.accentSoft, borderRadius: radius.inputLg, paddingVertical: space.md, paddingHorizontal: 14 },
  nudgeText: { ...type.bodySm, color: colors.accentText, flex: 1 },
  estimate: { ...type.caption, color: colors.muted, textAlign: 'center' },
});
