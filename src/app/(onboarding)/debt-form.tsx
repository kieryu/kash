import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type KeyboardTypeOptions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { createDebt, deleteDebt, getDebt, listDebts, updateDebt } from '@/db/repositories/debts';
import { getEntitlement, getSettings } from '@/db/repositories/settings';
import { balanceOf } from '@/db/repositories/transactions';
import {
  CUSTOM_TEMPLATE,
  formValuesOf,
  isInstallment,
  parseDebtEdit,
  parseDebtForm,
  saveDebtEdit,
  SEGMENTS,
  templateById,
  templatesFor,
  type DebtFormField,
  type DebtFormValues,
  type Segment,
} from '@/domain/debtForm';
import { annualFromMonthly, formatMoney, formatPercent, parseMoney, parsePercent, today } from '@/domain/format';
import { canAddDebt, readOnlyIds } from '@/domain/plan';
import { rescheduleReminders } from '@/notifications/reminders';
import { cardSwatches, theme } from '@/theme';
import { Button, IconButton } from '@/ui/Button';
import { SegmentedControl, TextField } from '@/ui/Controls';
import { DebtCard } from '@/ui/DebtCard';
import { BackIcon } from '@/ui/icons';

// Spoken names for the swatch row, same order as cardSwatches.
const SWATCH_NAMES = ['navy', 'green', 'red', 'orange', 'purple', 'black'];
const COLLAPSED = 6; // template grid shows 3×2 until "Show all"

function initial(segment: Segment): DebtFormValues {
  const t = templatesFor(segment)[0];
  return { segment, templateId: t.id, color: t.color, nickname: '', balance: '', rate: '', minimum: '', payment: '', monthsLeft: '', dueDay: '' };
}

const reschedule = (db: Awaited<ReturnType<typeof getAppDb>>) => rescheduleReminders(db).catch(() => {});

// 06 Add a debt; also Edit debt at /debt/[id]/edit (design/proposals/debt-edit.md).
export default function DebtForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [v, setV] = useState<DebtFormValues>(() => initial('card'));
  // Edit mode: the stored values and balance the form started from.
  const [orig, setOrig] = useState<{ values: DebtFormValues; balance: number; nickname: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<DebtFormField, string>>>({});
  const [currency, setCurrency] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [customColor, setCustomColor] = useState(false);

  useEffect(() => {
    getAppDb().then((db) => {
      const row = id ? getDebt(db, id) : undefined;
      if (!id) return setCurrency(getSettings(db).homeCurrency);
      if (!row) return router.back();
      // Over the free limit = read-only (D28).
      if (readOnlyIds(listDebts(db), getEntitlement(db).isPro).has(id)) return router.replace('/pro');
      const balance = balanceOf(db, id);
      const values = formValuesOf(row, balance);
      setV(values);
      setOrig({ values, balance, nickname: row.nickname });
      setCustomColor(!(cardSwatches as readonly string[]).includes(values.color) && values.color !== templateById(values.templateId)?.color);
      setCurrency(row.currency);
    });
  }, [id]);

  const set = (patch: Partial<DebtFormValues>) => setV((cur) => ({ ...cur, ...patch }));
  const tpl = templateById(v.templateId) ?? CUSTOM_TEMPLATE;
  const all = templatesFor(v.segment);
  const shown = showAll ? all : [...all.slice(0, COLLAPSED - 1), CUSTOM_TEMPLATE].filter((t, i, a) => a.indexOf(t) === i);
  const installment = isInstallment(v.segment);
  const optional = v.segment === 'other';
  const segmentLabel = SEGMENTS.find((s) => s.value === v.segment)!.kindLabel;

  const previewMinor = !currency
    ? null
    : installment
      ? (parseMoney(v.payment, currency) ?? 0) * (Number(v.monthsLeft) || 0)
      : parseMoney(v.balance, currency);
  const monthly = parsePercent(v.rate);
  const cardColor = /^#[0-9A-Fa-f]{6}$/.test(v.color) ? v.color : tpl.color; // while a custom hex is half typed

  const save = async () => {
    if (!currency) return;
    if (id && orig) {
      const e = parseDebtEdit(v, orig.values, orig.balance, currency);
      if (!e.ok) return setErrors(e.errors);
      const db = await getAppDb();
      saveDebtEdit(db, id, e.edit, today());
      reschedule(db); // due day may have changed
      return router.back();
    }
    const r = parseDebtForm(v, currency);
    if (!r.ok) return setErrors(r.errors);
    const db = await getAppDb();
    if (!canAddDebt(listDebts(db).length, getEntitlement(db).isPro)) return router.back();
    createDebt(db, r.debt, { balanceMinor: r.openingMinor, on: today() });
    router.back();
  };

  const archive = () =>
    Alert.alert(
      `Archive ${orig?.nickname}?`,
      'It leaves your plan and dashboard. History is kept and you can restore it from the Debts tab.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            const db = await getAppDb();
            updateDebt(db, id!, { archivedAt: new Date().toISOString() });
            reschedule(db);
            router.dismissTo('/');
          },
        },
      ],
    );

  const remove = () =>
    Alert.alert(`Delete ${orig?.nickname} and its history?`, 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const db = await getAppDb();
          deleteDebt(db, id!);
          reschedule(db);
          router.dismissTo('/');
        },
      },
    ]);

  const editing = Boolean(id);
  if (editing && !orig) return <SafeAreaView style={styles.screen} />;

  const field = (key: DebtFormField, label: string, keyboardType: KeyboardTypeOptions, placeholder?: string) => (
    <View style={styles.cell}>
      <TextField label={label} value={v[key]} onChangeText={(t) => set({ [key]: t })} keyboardType={keyboardType} placeholder={placeholder} />
      {errors[key] ? <Text style={styles.error}>{errors[key]}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <BackIcon size={24} color={colors.ink} />
        </IconButton>
        <Text accessibilityRole="header" style={styles.title}>
          {editing ? 'Edit debt' : 'Add a debt'}
        </Text>
      </View>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SegmentedControl
            accessibilityLabel="Debt type"
            options={SEGMENTS}
            value={v.segment}
            // Changing revolving ↔ installment changes the math: delete and re-add instead.
            disabled={editing}
            onChange={(segment) => {
              setV((cur) => ({ ...initial(segment), nickname: cur.nickname }));
              setErrors({});
              setShowAll(false);
            }}
          />

          <DebtCard
            variant="full"
            color={cardColor}
            issuer={tpl.id === 'custom' ? segmentLabel : tpl.issuer}
            kindLabel={segmentLabel}
            nickname={v.nickname || 'Nickname'}
            balanceText={currency ? formatMoney(previewMinor ?? 0, currency) : ''}
            network={tpl.network}
          />

          <View style={styles.group}>
            <Text style={styles.label}>Card template</Text>
            <View style={styles.grid}>
              {shown.map((t) => {
                const on = t.id === v.templateId;
                return (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${t.issuer} ${t.network ?? t.product}`}
                    onPress={() => {
                      set({ templateId: t.id, color: t.color });
                      setCustomColor(false);
                    }}
                    style={[styles.tpl, { backgroundColor: t.color }, on && styles.tplOn]}
                  >
                    <Text style={styles.tplIssuer} numberOfLines={1}>
                      {t.issuer}
                    </Text>
                    <Text style={styles.tplSub} numberOfLines={1}>
                      {t.network ?? t.product}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {all.length > COLLAPSED ? (
              <Button variant="link" label={showAll ? 'Show fewer' : 'Show all banks'} onPress={() => setShowAll(!showAll)} />
            ) : null}
            <View style={styles.swatches}>
              {cardSwatches.map((hex, i) => (
                <Pressable
                  key={hex}
                  accessibilityRole="button"
                  accessibilityLabel={`Card color ${SWATCH_NAMES[i]}`}
                  accessibilityState={{ selected: !customColor && v.color.toUpperCase() === hex }}
                  hitSlop={7}
                  onPress={() => {
                    set({ color: hex });
                    setCustomColor(false);
                  }}
                  style={[styles.swatch, { backgroundColor: hex }, !customColor && v.color.toUpperCase() === hex && styles.swatchOn]}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Custom card color"
                accessibilityState={{ selected: customColor }}
                onPress={() => setCustomColor(true)}
                hitSlop={7}
                style={styles.customRow}
              >
                <View style={[styles.swatch, { backgroundColor: cardColor }, customColor && styles.swatchOn]} />
                <Text style={styles.customText}>Custom</Text>
              </Pressable>
            </View>
            {customColor ? (
              <View>
                <TextField label="Card color (hex)" value={v.color} onChangeText={(color) => set({ color })} autoCapitalize="characters" maxLength={7} placeholder={colors.primary} />
                {errors.color ? <Text style={styles.error}>{errors.color}</Text> : null}
              </View>
            ) : null}
          </View>

          {field('nickname', 'Nickname', 'default', 'e.g. Everyday Card')}

          {installment ? (
            <View style={styles.row}>
              {field('payment', 'Monthly payment', 'decimal-pad')}
              {field('monthsLeft', 'Payments left', 'number-pad')}
            </View>
          ) : (
            <View style={styles.row}>
              {editing ? null : field('balance', 'Current balance', 'decimal-pad')}
              {field('rate', optional ? 'Interest / month (optional)' : 'Interest / month', 'decimal-pad', '3%')}
            </View>
          )}
          <View style={styles.row}>
            {installment ? null : field('minimum', optional ? 'Monthly payment (optional)' : 'Minimum payment', 'decimal-pad', 'Amount or 3%')}
            {field('dueDay', v.segment === 'card' ? 'Due day' : 'Due day (optional)', 'number-pad', '1–31')}
            {installment ? <View style={styles.cell} /> : null}
          </View>

          {editing && !installment ? <Text style={styles.hint}>To change the balance, use Update balance.</Text> : null}

          <Text style={styles.hint}>
            {installment
              ? 'What’s left = monthly payment × payments left.'
              : monthly
                ? `= ${formatPercent(annualFromMonthly(monthly))} a year.`
                : 'Use the monthly rate on your statement.'}
          </Text>

          <View style={styles.safe}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            </Svg>
            <Text style={styles.safeText}>{APP_NAME} never asks for your card number, CVV or expiry. Not affiliated with any bank or card network.</Text>
          </View>

          {editing ? (
            <View style={styles.danger}>
              <Button variant="link" label="Archive debt" onPress={archive} />
              <Button variant="link" label="Delete debt" color={colors.danger} onPress={remove} />
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button label={editing ? 'Save changes' : 'Save debt'} onPress={save} disabled={!currency} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  title: { ...type.screenHeader, color: colors.ink },
  content: { paddingHorizontal: space.screenOnboarding, paddingTop: space.sm, paddingBottom: space.lg, gap: 18 },
  group: { gap: space.sm },
  label: { ...type.label, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tpl: { width: '31.5%', minHeight: 58, borderRadius: radius.input, padding: space.sm, paddingHorizontal: 10, justifyContent: 'space-between', borderWidth: 3, borderColor: 'transparent' },
  tplOn: { borderColor: colors.accent },
  tplIssuer: { ...type.captionBold, color: colors.onPrimary },
  tplSub: { ...type.micro, color: colors.onPrimary, opacity: 0.9 },
  swatches: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.surface },
  swatchOn: { borderWidth: 3, borderColor: colors.accent },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: 'auto' },
  customText: { ...type.segment, color: colors.ink },
  row: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1, gap: space.xs },
  error: { ...type.caption, color: colors.danger },
  hint: { ...type.small, color: colors.muted },
  safe: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  safeText: { ...type.small, color: colors.inkSoft, flex: 1 },
  danger: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, alignItems: 'flex-start' },
  footer: { paddingHorizontal: space.screenOnboarding, paddingTop: space.md, paddingBottom: space.xxl },
});
