import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { listDebts } from '@/db/repositories/debts';
import { getEntitlement } from '@/db/repositories/settings';
import type { DebtRow } from '@/db/schema';
import { debtsList, loadSnapshot, moneyText, paidOffText, type LoadedSnapshot } from '@/domain/dashboard';
import { KIND_LABELS, templateById } from '@/domain/debtForm';
import { today } from '@/domain/format';
import { canAddDebt, FREE_DEBT_LIMIT } from '@/domain/plan';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { DebtCard } from '@/ui/DebtCard';
import { CheckIcon, PlusIcon } from '@/ui/icons';
import { Mascot } from '@/ui/Mascot';

const PAID_COLLAPSED = 3;

// Debts tab (design/proposals/debts-tab.md). Route is "wallet": /debts is onboarding 05.
export default function Wallet() {
  const [data, setData] = useState<{ snap: LoadedSnapshot; archived: DebtRow[]; canAdd: boolean } | null>(null);
  const [limitNote, setLimitNote] = useState(false);
  const [allPaid, setAllPaid] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getAppDb().then((db) => {
        const snap = loadSnapshot(db);
        setData({
          snap,
          archived: listDebts(db, { includeArchived: true }).filter((r) => r.archivedAt),
          canAdd: canAddDebt(snap.rows.length, getEntitlement(db).isPro),
        });
      });
    }, []),
  );
  const list = useMemo(() => (data ? debtsList(data.snap, today()) : null), [data]);
  if (!data || !list) return null;

  const { snap } = data;
  const hide = snap.settings.hideBalances;
  const home = snap.settings.homeCurrency;
  const open = (id: string) => router.push({ pathname: '/debt/[id]', params: { id } });
  const paidShown = allPaid ? list.paidOff : list.paidOff.slice(0, PAID_COLLAPSED);
  const count = list.active.length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Your debts
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a debt"
          onPress={() => (data.canAdd ? router.push('/debt-form') : setLimitNote(true))}
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        >
          <PlusIcon size={18} color={colors.primary} />
          <Text style={styles.pillText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {limitNote && !data.canAdd ? (
          <Text style={styles.warn}>
            The free plan holds {FREE_DEBT_LIMIT} debts.{' '}
            <Text accessibilityRole="link" style={styles.warnLink} onPress={() => router.push('/pro')}>
              See {APP_NAME} Pro
            </Text>
          </Text>
        ) : null}

        {snap.rows.length === 0 ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => router.push('/debt-form')} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
              <View style={styles.plus}>
                <PlusIcon size={22} color={colors.primary} />
              </View>
              <Text style={styles.addTitle}>Add a card or loan</Text>
              <Text style={styles.small}>Credit card · Installment · SSS / Pag-IBIG · Family</Text>
            </Pressable>
            <View style={styles.tip}>
              <Mascot mood="think" size={64} />
              <Text style={styles.tipText}>Put every debt in, even small ones. The plan works best when everything is in it.</Text>
            </View>
          </>
        ) : (
          <View style={styles.totals} accessible>
            <Text style={styles.small}>Total left</Text>
            <Text style={styles.total}>{moneyText(list.totalLeft, home, hide)}</Text>
            <Text style={styles.small}>
              {count} {count === 1 ? 'debt' : 'debts'} · {moneyText(list.minimums, home, hide)} minimums a month
            </Text>
          </View>
        )}

        {list.active.map((i) => (
          <View key={i.debt.id} style={styles.item}>
            <DebtCard
              variant="list"
              color={i.debt.color}
              nickname={i.debt.nickname}
              balanceText={moneyText(i.balance, i.debt.currency, hide)}
              issuer={i.debt.issuer ?? KIND_LABELS[i.debt.kind]}
              kindLabel={KIND_LABELS[i.debt.kind]}
              network={templateById(i.debt.templateId)?.network}
              onPress={() => open(i.debt.id)}
              accessibilityLabel={`${i.debt.nickname}, ${moneyText(i.balance, i.debt.currency, hide)}, ${i.payoffText}`}
            />
            <View style={styles.under}>
              {i.isFocus ? <Text style={styles.focusChip}>FOCUS</Text> : null}
              {snap.readOnly.has(i.debt.id) ? <Text style={styles.roChip}>Read-only</Text> : null}
              <Text style={styles.caption}>{i.payoffText}</Text>
            </View>
          </View>
        ))}

        {list.paidOff.length > 0 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Paid off
            </Text>
            <View style={styles.card}>
              {paidShown.map((d) => (
                <CompactRow key={d.id} debt={d} sub={paidOffText(d)} done onPress={() => open(d.id)} />
              ))}
            </View>
            {list.paidOff.length > PAID_COLLAPSED ? (
              <Button variant="link" label={allPaid ? 'Show fewer' : `Show all (${list.paidOff.length})`} onPress={() => setAllPaid(!allPaid)} />
            ) : null}
          </View>
        ) : null}

        {data.archived.length > 0 ? (
          <View style={styles.section}>
            <Button variant="link" label={showArchived ? 'Hide archived' : `Show archived (${data.archived.length})`} onPress={() => setShowArchived(!showArchived)} />
            {showArchived ? (
              <View style={[styles.card, styles.muted]}>
                {data.archived.map((d) => (
                  <CompactRow key={d.id} debt={d} sub="Archived" onPress={() => open(d.id)} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CompactRow({ debt, sub, done, onPress }: { debt: DebtRow; sub: string; done?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${debt.nickname}, ${sub}`} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.bar, { backgroundColor: debt.color }]} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {debt.nickname}
        </Text>
        <Text style={styles.caption}>{sub}</Text>
      </View>
      {done ? (
        <View style={styles.donePill}>
          <CheckIcon size={16} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

const { colors, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.screenApp, paddingTop: space.md, paddingBottom: space.sm },
  title: { ...type.screenHeader, color: colors.ink },
  pill: {
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
  pillText: { ...type.label, color: colors.primary },
  pressed: { opacity: 0.85 },
  content: { paddingHorizontal: space.screenApp, paddingTop: space.sm, paddingBottom: space.xl, gap: space.lg },
  warn: { ...type.bodySm, color: colors.accentText, backgroundColor: colors.accentSoft, borderRadius: radius.input, padding: space.md, overflow: 'hidden' },
  warnLink: { ...type.label, color: colors.accentText, textDecorationLine: 'underline' },
  totals: { backgroundColor: colors.surface, borderRadius: radius.cardLg - 2, padding: 18, gap: space.xs },
  total: { ...type.amount, color: colors.ink },
  small: { ...type.small, color: colors.muted },
  caption: { ...type.caption, color: colors.muted, flexShrink: 1 },
  item: { gap: space.sm },
  under: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  focusChip: { ...type.microBold, color: colors.proChipText, backgroundColor: colors.proChipBg, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: space.sm, overflow: 'hidden' },
  roChip: { ...type.microBold, color: colors.muted, backgroundColor: colors.segmentBg, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: space.sm, overflow: 'hidden' },
  section: { gap: 10 },
  sectionTitle: { ...type.sectionTitle, color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: space.lg },
  muted: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.divider },
  bar: { width: 4, height: 32, borderRadius: 2 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.rowTitleSm, color: colors.ink },
  donePill: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  add: {
    minHeight: size.debtCardList,
    padding: space.lg,
    borderRadius: radius.cardLg - 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.dashedLine,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  plus: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  addTitle: { ...type.button, color: colors.primary },
  tip: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: space.md, paddingHorizontal: 14 },
  tipText: { ...type.bodySm, color: colors.inkSoft, flex: 1 },
});
