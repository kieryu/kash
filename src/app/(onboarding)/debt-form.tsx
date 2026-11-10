import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, type KeyboardTypeOptions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { createDebt, deleteDebt, getDebt, listDebts } from '@/db/repositories/debts';
import { getEntitlement, getSettings } from '@/db/repositories/settings';
import { balanceOf, listTransactions } from '@/db/repositories/transactions';
import {
  CUSTOM_TEMPLATE,
  formValuesOf,
  installmentInputsOf,
  isInstallment,
  issuersFor,
  optionLabel,
  parseDebtEdit,
  parseDebtForm,
  saveDebtEdit,
  SEGMENTS,
  templateById,
  templateName,
  templatesFor,
  type DebtFormField,
  type DebtFormValues,
  type Template,
  type Segment,
} from '@/domain/debtForm';
import { pickerColor, pickerStart } from '@/domain/color';
import { currencySymbol } from '@/domain/dashboard';
import { annualFromMonthly, currentYearMonth, formatMoney, formatPercent, parseMoney, parsePercent, today } from '@/domain/format';
import {
  childrenOf,
  createCardWithInstallments,
  onStatement,
  parseInstallments,
  revolvingFromStatement,
  saveInstallments,
  setFamilyArchived,
  type InstallmentErrors,
  type InstallmentInput,
  type ParsedInstallment,
} from '@/domain/installments';
import { firstPayoff } from '@/domain/payments';
import { canAddDebt, debtCount, readOnlyIds } from '@/domain/plan';
import { rescheduleReminders } from '@/notifications/reminders';
import { cardSwatches, theme } from '@/theme';
import { Button, Chip, IconButton } from '@/ui/Button';
import { MoneyField, SegmentedControl, TextField } from '@/ui/Controls';
import { DebtCard } from '@/ui/DebtCard';
import { KeyboardAvoid } from '@/ui/Keyboard';
import { ColorPicker } from '@/ui/ColorPicker';
import { InstallmentFields } from '@/ui/InstallmentFields';
import { SelectField } from '@/ui/Select';
import { BackIcon } from '@/ui/icons';

// Spoken names for the swatch row, same order as cardSwatches.
const SWATCH_NAMES = ['navy', 'green', 'red', 'orange', 'purple', 'black'];
// R16: what the issuer dropdown is called per debt type.
const ISSUER_LABEL: Record<Segment, string> = { card: 'Bank', installment: 'Bank or provider', loan: 'Lender', other: 'Type' };
// Custom only: the free-text name on the card's top line (empty = the debt type).
const CUSTOM_ISSUER: Record<Segment, { label: string; placeholder: string }> = {
  card: { label: 'Bank or issuer (optional)', placeholder: 'e.g. GCash, Maya' },
  installment: { label: 'Provider (optional)', placeholder: 'e.g. Home Credit' },
  loan: { label: 'Lender (optional)', placeholder: 'e.g. Tonik' },
  other: { label: 'Lender (optional)', placeholder: 'e.g. Tita Mila' },
};

function initial(segment: Segment): DebtFormValues {
  const t = templatesFor(segment)[0];
  return { segment, templateId: t.id, color: t.color, nickname: '', issuer: '', balance: '', rate: '', minimum: '', payment: '', monthsLeft: '', dueDay: '', statementDay: '' };
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
  const [customColor, setCustomColor] = useState(false);
  // R20: installments running on a card. `origInsts` = what the edit form started from.
  const [hasInst, setHasInst] = useState(false);
  const [insts, setInsts] = useState<InstallmentInput[]>([]);
  const [instErrors, setInstErrors] = useState<InstallmentErrors[]>([]);
  const [origInsts, setOrigInsts] = useState<ParsedInstallment[]>([]);

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
      const kids = childrenOf(listDebts(db), id);
      const inputs = installmentInputsOf(kids, kids.flatMap((k) => listTransactions(db, k.id)), currentYearMonth());
      const parsed = parseInstallments(inputs, row.currency);
      setInsts(inputs);
      setHasInst(inputs.length > 0);
      setOrigInsts(parsed.ok ? parsed.items : []);
    });
  }, [id]);

  const set = (patch: Partial<DebtFormValues>) => setV((cur) => ({ ...cur, ...patch }));
  const tpl = templateById(v.templateId) ?? CUSTOM_TEMPLATE;
  // R15/R16: pick the bank from a dropdown, then its network (Visa / Mastercard / …) when it has more than one.
  const issuers = issuersFor(v.segment);
  const issuer = issuers.find((g) => g.templates.some((t) => t.id === tpl.id)) ?? issuers[issuers.length - 1];
  const pick = (t: Template) => {
    set({ templateId: t.id, color: t.color });
    setCustomColor(false);
  };
  // R5: a bank template names the debt unless a nickname is given; Custom needs its own name.
  const defaultName = templateName(tpl);
  const nameLabel = defaultName ? 'Nickname (optional)' : v.segment === 'card' ? 'Card name' : 'Name';
  const installment = isInstallment(v.segment);
  const optional = v.segment === 'other';
  const segmentLabel = SEGMENTS.find((s) => s.value === v.segment)!.kindLabel;

  const previewMinor = !currency
    ? null
    : installment
      ? (parseMoney(v.payment, currency) ?? 0) * (Number(v.monthsLeft) || 0)
      : parseMoney(v.balance, currency);
  const monthly = parsePercent(v.rate);
  const cardColor = /^#[0-9A-Fa-f]{6}$/.test(v.color) ? v.color : tpl.color;

  const save = async () => {
    if (!currency) return;
    const card = v.segment === 'card';
    const inst: ReturnType<typeof parseInstallments> = card && hasInst ? parseInstallments(insts, currency) : { ok: true, items: [] };
    setInstErrors(inst.ok ? [] : inst.errors);
    if (id && orig) {
      const e = parseDebtEdit(v, orig.values, orig.balance, currency);
      if (!e.ok) return setErrors(e.errors);
      if (!inst.ok) return setErrors({});
      const db = await getAppDb();
      const changed = saveDebtEdit(db, id, e.edit, today());
      if (card) saveInstallments(db, id, origInsts, inst.items, currentYearMonth(), today());
      reschedule(db); // due day may have changed
      if (changed && firstPayoff(db, id)) return router.replace({ pathname: '/paid-off/[id]', params: { id } });
      return router.back();
    }
    const r = parseDebtForm(v, currency);
    if (!r.ok) return setErrors(r.errors);
    if (!inst.ok) return setErrors({});
    if (revolvingFromStatement(r.openingMinor, inst.items) < 0) {
      const billed = inst.items.filter(onStatement).reduce((s, i) => s + i.amountMinor, 0);
      return setErrors({ balance: `Use the total on your statement. It includes this month’s installments (${formatMoney(billed, currency)}).` });
    }
    setErrors({});
    const db = await getAppDb();
    if (!canAddDebt(debtCount(listDebts(db)), getEntitlement(db).isPro)) return router.back();
    if (inst.items.length > 0) createCardWithInstallments(db, r.debt, r.openingMinor, inst.items, today());
    else createDebt(db, r.debt, { balanceMinor: r.openingMinor, on: today() });
    reschedule(db); // due and statement reminders for the new debt
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
            setFamilyArchived(db, id!, new Date().toISOString());
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
  // R19: plain amounts get the currency sign and thousands commas as you type.
  const moneyField = (key: 'balance' | 'payment', label: string) => (
    <View style={styles.cell}>
      {currency ? (
        <MoneyField label={label} prefix={currencySymbol(currency)} currency={currency} value={v[key]} onChangeText={(t) => set({ [key]: t })} placeholder="0" />
      ) : (
        <TextField label={label} value={v[key]} editable={false} />
      )}
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
      <KeyboardAvoid>
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
              setHasInst(false);
              setInsts([]);
              setInstErrors([]);
            }}
          />

          <DebtCard
            variant="full"
            color={cardColor}
            issuer={tpl.id === 'custom' ? v.issuer.trim() || segmentLabel : tpl.issuer}
            kindLabel={segmentLabel}
            nickname={v.nickname || defaultName || nameLabel}
            balanceText={currency ? formatMoney(previewMinor ?? 0, currency) : ''}
            network={tpl.network}
          />

          <View style={styles.group}>
            <SelectField
              label={ISSUER_LABEL[v.segment]}
              value={issuer.issuer}
              options={issuers.map((g) => ({ value: g.issuer, label: g.issuer, color: g.templates[0].color }))}
              onChange={(name) => pick(issuers.find((g) => g.issuer === name)!.templates[0])}
            />
            {issuer.templates.length > 1 ? (
              <View style={styles.group}>
                <Text style={styles.label}>{v.segment === 'card' || v.segment === 'installment' ? 'Card network' : 'Kind'}</Text>
                <View style={styles.chips}>
                  {issuer.templates.map((t) => (
                    <Chip key={t.id} label={optionLabel(t, issuer.templates)} selected={t.id === tpl.id} onPress={() => pick(t)} />
                  ))}
                </View>
              </View>
            ) : null}
            {tpl.id === 'custom' ? (
              <View style={styles.cell}>
                <TextField
                  label={CUSTOM_ISSUER[v.segment].label}
                  value={v.issuer}
                  onChangeText={(t) => set({ issuer: t })}
                  placeholder={CUSTOM_ISSUER[v.segment].placeholder}
                  maxLength={40}
                />
                {errors.issuer ? <Text style={styles.error}>{errors.issuer}</Text> : null}
              </View>
            ) : null}
            <Text style={styles.label}>Card color</Text>
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
                onPress={() => {
                  // Start on the picker's own color so the preview matches the sliders (black/gray → a visible color).
                  if (!customColor) {
                    const start = pickerStart(cardColor);
                    set({ color: pickerColor(start.hue, start.shade) });
                  }
                  setCustomColor(true);
                }}
                hitSlop={7}
                style={styles.customRow}
              >
                <View style={[styles.swatch, { backgroundColor: cardColor }, customColor && styles.swatchOn]} />
                <Text style={styles.customText}>Custom</Text>
              </Pressable>
            </View>
            {customColor ? <ColorPicker value={cardColor} onChange={(color) => set({ color })} /> : null}
          </View>

          {field('nickname', nameLabel, 'default', defaultName ?? 'e.g. Everyday Card')}

          {installment ? (
            <View style={styles.row}>
              {moneyField('payment', 'Monthly payment')}
              {field('monthsLeft', 'Payments left', 'number-pad')}
            </View>
          ) : (
            <View style={styles.row}>
              {editing ? null : moneyField('balance', hasInst && v.segment === 'card' ? 'Statement balance' : 'Current balance')}
              {field('rate', optional ? 'Interest / month (optional)' : 'Interest / month', 'decimal-pad', '3%')}
            </View>
          )}
          <View style={styles.row}>
            {installment ? null : field('minimum', optional ? 'Monthly payment (optional)' : 'Minimum payment', 'decimal-pad', 'Amount or 3%')}
            {field('dueDay', v.segment === 'card' ? 'Due day' : 'Due day (optional)', 'number-pad', '1–31')}
            {installment ? <View style={styles.cell} /> : null}
          </View>
          {v.segment === 'card' ? (
            <>
              <View style={styles.row}>
                {field('statementDay', 'Statement day (optional)', 'number-pad', '1–31')}
                <View style={styles.cell} />
              </View>
              <Text style={styles.hint}>The day your bank sends your bill. We’ll remind you to update your balance.</Text>
              <InstallmentFields
                on={hasInst}
                onToggle={setHasInst}
                items={insts}
                errors={instErrors}
                currency={currency}
                editing={editing}
                onChange={setInsts}
              />
              {hasInst && !editing ? <Text style={styles.hint}>Statement balance = the total on your statement, this month’s installments included.</Text> : null}
            </>
          ) : null}

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
      </KeyboardAvoid>
    </SafeAreaView>
  );
}

const { colors, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  title: { ...type.screenHeader, color: colors.ink },
  content: { paddingHorizontal: space.screenOnboarding, paddingTop: space.sm, paddingBottom: space.lg, gap: 18 },
  group: { gap: space.sm },
  label: { ...type.label, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
