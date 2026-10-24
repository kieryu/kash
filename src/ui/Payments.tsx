import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Button, Chip } from './Button';
import { CheckIcon, TargetIcon } from './icons';

// Presentational only: amounts arrive formatted, the screen owns the plan and the DB writes.

type FocusProps = {
  color: string;
  name: string;
  dueText: string;
  amountText: string;
  /** e.g. "₱850 min + ₱4,685 extra". */
  splitText: string;
  /** Set once logged, e.g. "Paid ₱5,535 · as planned". */
  paidText?: string | null;
  onLog: () => void;
  onUndo: () => void;
};

export function FocusDebtCard({ color, name, dueText, amountText, splitText, paidText, onLog, onUndo }: FocusProps) {
  return (
    <View style={styles.focus}>
      <View style={styles.focusLabel}>
        <TargetIcon size={14} color={colors.accentLabel} />
        <Text style={styles.focusLabelText}>FOCUS DEBT · PAY EXTRA HERE</Text>
      </View>
      <View style={styles.focusMain}>
        <View style={styles.nameRow}>
          <View style={[styles.colorBar, styles.colorBarTall, { backgroundColor: color }]} />
          <View style={styles.names}>
            <Text style={styles.focusName}>{name}</Text>
            <Text style={styles.sub}>{dueText}</Text>
          </View>
        </View>
        <View style={styles.focusAmount}>
          <Text style={styles.amount}>{amountText}</Text>
          <Text style={styles.split}>{splitText}</Text>
        </View>
      </View>
      {paidText ? (
        <View style={styles.paidBar}>
          <View style={styles.paidText}>
            <CheckIcon size={16} color={colors.primary} />
            <Text style={styles.paidLabel}>{paidText}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Undo payment for ${name}`} onPress={onUndo} style={styles.undo}>
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        </View>
      ) : (
        <Button variant="compact" label="Log payment" accessibilityLabel={`Log payment for ${name}`} onPress={onLog} />
      )}
    </View>
  );
}

type RowProps = {
  color: string;
  name: string;
  /** "Due Oct 30 · ₱1,000" or "Paid ₱1,000 · logged". */
  sub: string;
  status: 'due' | 'paid' | 'auto';
  onLog: () => void;
  onUndo: () => void;
};

export function PaymentRow({ color, name, sub, status, onLog, onUndo }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.colorBar, { backgroundColor: color }]} />
      <View style={[styles.names, styles.grow]}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      {status === 'paid' && (
        <Pressable accessibilityRole="button" accessibilityLabel={`${name} paid. Tap to undo`} onPress={onUndo} style={[styles.pill, styles.pillPaid]}>
          <CheckIcon size={14} color={colors.primary} />
          <Text style={styles.pillText}>Paid</Text>
        </Pressable>
      )}
      {status === 'auto' && <Text style={styles.auto}>Auto-deducted</Text>}
      {status === 'due' && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Log payment for ${name}`} onPress={onLog} style={[styles.pill, styles.pillLog]}>
          <Text style={styles.pillText}>Log</Text>
        </Pressable>
      )}
    </View>
  );
}

type SheetProps = {
  visible: boolean;
  title: string;
  hint: string;
  dateLabel: string;
  currencySymbol: string;
  amountText: string;
  onChangeAmount: (text: string) => void;
  chips: { label: string; selected: boolean; onPress: () => void }[];
  /** good = green, warn = amber (below plan or minimum). */
  impact: { text: string; tone: 'good' | 'warn' };
  onSave: () => void;
  onClose: () => void;
};

export function LogPaymentSheet(p: SheetProps) {
  const insets = useSafeAreaInsets();
  const good = p.impact.tone === 'good';
  return (
    <Modal visible={p.visible} transparent animationType="fade" onRequestClose={p.onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={p.onClose} style={styles.scrim} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <View style={[styles.names, styles.grow]}>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                {p.title}
              </Text>
              <Text style={styles.small}>{p.hint}</Text>
            </View>
            <Text style={styles.date}>{p.dateLabel}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Amount you paid</Text>
            <View style={styles.amountBox}>
              <Text style={styles.amountInput}>{p.currencySymbol}</Text>
              <TextInput
                accessibilityLabel="Amount you paid"
                value={p.amountText}
                onChangeText={p.onChangeAmount}
                keyboardType="decimal-pad"
                style={[styles.amountInput, styles.grow]}
              />
            </View>
          </View>
          <View style={styles.chips}>
            {p.chips.map((c) => (
              <Chip key={c.label} label={c.label} selected={c.selected} onPress={c.onPress} />
            ))}
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.impact, good ? styles.impactGood : styles.impactWarn]}>
            {p.impact.text}
          </Text>
          <Button label="Save payment" onPress={p.onSave} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const { colors, opacity, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  focus: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: space.lg,
    gap: space.md,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  focusLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  focusLabelText: { ...type.microBold, color: colors.accentLabel },
  focusMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  colorBar: { width: size.colorBar, height: 32, borderRadius: 4 },
  colorBarTall: { height: 36 },
  names: { gap: 2, flexShrink: 1 },
  grow: { flex: 1 },
  focusName: { ...type.rowTitle, color: colors.ink },
  sub: { ...type.caption, color: colors.muted },
  focusAmount: { alignItems: 'flex-end', gap: 2 },
  amount: { ...type.amountSm, color: colors.ink },
  split: { ...type.micro, color: colors.muted },
  paidBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.hitTarget,
    borderRadius: radius.input,
    backgroundColor: colors.primarySoft,
    paddingLeft: 14,
    paddingRight: 6,
  },
  paidText: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  paidLabel: { ...type.rowTitleSm, color: colors.primary },
  undo: { minHeight: size.hitTarget, justifyContent: 'center', paddingHorizontal: space.md },
  undoText: { ...type.chip, color: colors.primary, textDecorationLine: 'underline' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, borderTopWidth: 1, borderTopColor: colors.divider },
  rowName: { ...type.rowTitleSm, color: colors.ink },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: size.hitTarget, paddingHorizontal: 14, borderRadius: radius.pill },
  pillPaid: { backgroundColor: colors.primarySoft },
  pillLog: { backgroundColor: colors.surface, borderWidth: size.border, borderColor: colors.lineStrong },
  pillText: { ...type.chip, color: colors.primary },
  auto: { ...type.caption, color: colors.muted, paddingHorizontal: space.xs },

  modal: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.ink, opacity: opacity.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 10,
    paddingHorizontal: space.xl,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: size.sheetHandleWidth,
    height: size.sheetHandleHeight,
    borderRadius: size.sheetHandleHeight / 2,
    backgroundColor: colors.handle,
  },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  sheetTitle: { ...type.sheetTitle, color: colors.ink },
  small: { ...type.small, color: colors.muted },
  date: { ...type.caption, color: colors.muted, paddingTop: space.xs },
  field: { gap: 6 },
  label: { ...type.label, color: colors.muted },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: radius.inputLg,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    gap: 6,
  },
  amountInput: { ...type.amountInput, color: colors.ink, padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  impact: { ...type.bodySm, borderRadius: radius.input, paddingVertical: space.md, paddingHorizontal: 14, overflow: 'hidden' },
  impactGood: { backgroundColor: colors.primarySoft, color: colors.onPrimarySoft },
  impactWarn: { backgroundColor: colors.accentSoft, color: colors.accentText },
});
