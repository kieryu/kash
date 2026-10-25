import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { checkInImpact, impactText, REASON_LABELS, REASON_NOTES, reasonsFor, saveCheckIn, statementDate, type CheckInReason } from '@/domain/checkin';
import { balancesOf, loadSnapshot, moneyText, shortDate, type LoadedSnapshot } from '@/domain/dashboard';
import { parseMoney, today } from '@/domain/format';
import { firstPayoff } from '@/domain/payments';
import { rescheduleReminders } from '@/notifications/reminders';
import { theme } from '@/theme';
import { Note } from '@/ui/Backup';
import { Button, Chip, IconButton } from '@/ui/Button';
import { TextField } from '@/ui/Controls';
import { CloseIcon } from '@/ui/icons';
import { Mascot } from '@/ui/Mascot';

// 10 Statement check-in. From 09 Debt detail ("Update balance") or a statement-day reminder.
export default function CheckIn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [snap, setSnap] = useState<LoadedSnapshot | null>(null);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<CheckInReason | null>(null);
  useEffect(() => {
    getAppDb().then((db) => setSnap(loadSnapshot(db)));
  }, []);

  const debt = snap?.rows.find((r) => r.id === id);
  const day = today();
  const on = statementDate(debt?.statementDay ?? null, day);
  const amount = debt ? parseMoney(text, debt.currency) : null;
  const expected = snap ? (balancesOf(snap.txs).get(id) ?? 0) : 0;
  const difference = amount === null ? 0 : amount - expected;
  const options = reasonsFor(difference);
  const reason = picked && options.includes(picked) ? picked : (options[0] ?? null);
  const impact = snap && amount !== null ? checkInImpact(snap, id, amount, reason, on) : null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!snap) return null;
  if (!debt) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header pill={null} onClose={close} />
        <Text style={[styles.body, styles.padded]}>This debt isn’t here anymore.</Text>
      </SafeAreaView>
    );
  }
  if (snap.readOnly.has(debt.id)) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header pill="Statement check-in" onClose={close} />
        <View style={[styles.padded, styles.readOnly]}>
          <Note>{debt.nickname} is read-only on the free plan. It still counts in your plan and totals.</Note>
          <Button variant="secondary" label={`See ${APP_NAME} Pro`} onPress={() => router.replace('/pro')} />
        </View>
      </SafeAreaView>
    );
  }
  const money = (n: number) => moneyText(n, debt.currency, snap.settings.hideBalances);

  const save = async () => {
    if (amount === null) return;
    const db = await getAppDb();
    const changed = saveCheckIn(db, debt.id, amount, reason, on);
    if (changed) rescheduleReminders(db).catch(() => {});
    if (changed && firstPayoff(db, debt.id)) return router.replace({ pathname: '/paid-off/[id]', params: { id: debt.id } });
    close();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Header pill={debt.statementDay ? `Statement day · ${shortDate(on)}` : 'Statement check-in'} onClose={close} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Mascot mood="think" size={72} />
          <Text accessibilityRole="header" style={styles.title}>
            Update your {debt.nickname} balance
          </Text>
        </View>
        <Text style={styles.body}>Your new statement is out. Type the balance shown on it, and Kash will adjust your plan.</Text>
        <View style={styles.expected}>
          <Text style={styles.small}>Kash expected</Text>
          <Text style={styles.expectedValue}>{money(expected)}</Text>
        </View>
        <TextField
          label="Statement balance"
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder="0.00"
          style={styles.amountInput}
        />

        {amount !== null && difference !== 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              <Text style={styles.strong}>
                {difference > 0 ? '+' : '−'}
                {money(Math.abs(difference))}
              </Text>
              {difference > 0 ? ' more than expected. What was it?' : ' less than expected.'}
            </Text>
            <View style={styles.chips}>
              {options.map((o) => (
                <Chip key={o} label={REASON_LABELS[o]} selected={o === reason} onPress={() => setPicked(o)} />
              ))}
            </View>
            {reason ? <Text style={styles.cardNote}>{REASON_NOTES[reason]}</Text> : null}
          </View>
        ) : null}
        {amount !== null && difference === 0 ? <Text style={styles.body}>Matches what Kash expected. Nice.</Text> : null}

        {impact ? <Note>{impactText(impact.before, impact.after, reason)}</Note> : null}
        <Text style={styles.footnote}>Estimates only — real statements may differ.</Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Save balance" onPress={save} disabled={amount === null} />
      </View>
    </SafeAreaView>
  );
}

function Header({ pill, onClose }: { pill: string | null; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton accessibilityLabel="Close" onPress={onClose}>
        <CloseIcon size={22} color={colors.ink} />
      </IconButton>
      {pill ? <Text style={styles.pill}>{pill}</Text> : null}
    </View>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  pill: { ...type.captionBold, color: colors.proChipText, backgroundColor: colors.proChipBg, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: space.md, overflow: 'hidden' },
  padded: { paddingHorizontal: space.screenOnboarding },
  readOnly: { gap: space.md, paddingTop: space.lg },
  content: { paddingHorizontal: space.screenOnboarding, paddingTop: space.sm, paddingBottom: space.lg, gap: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { ...type.screenHeader, color: colors.ink, flex: 1 },
  body: { ...type.body, color: colors.muted },
  small: { ...type.bodySm, color: colors.muted },
  expected: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.inputLg, paddingVertical: 14, paddingHorizontal: space.lg },
  expectedValue: { ...type.rowTitleSm, color: colors.ink },
  amountInput: { ...type.amountInput, minHeight: 60, borderWidth: 2, borderColor: colors.primary, borderRadius: radius.inputLg },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg, gap: space.md },
  cardText: { ...type.body, color: colors.ink },
  strong: { ...type.rowTitle, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cardNote: { ...type.bodySm, color: colors.inkSoft },
  footnote: { ...type.caption, color: colors.muted, textAlign: 'center' },
  footer: { paddingHorizontal: space.screenOnboarding, paddingTop: space.md, paddingBottom: space.xxl },
});
