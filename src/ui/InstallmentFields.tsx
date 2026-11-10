import { StyleSheet, Text, View } from 'react-native';

import { currencySymbol } from '@/domain/dashboard';
import { EMPTY_INSTALLMENT, type InstallmentErrors, type InstallmentInput } from '@/domain/installments';
import { theme } from '@/theme';
import { Button, Chip } from '@/ui/Button';
import { MoneyField, TextField } from '@/ui/Controls';

type Props = {
  on: boolean;
  onToggle: (on: boolean) => void;
  items: InstallmentInput[];
  errors: InstallmentErrors[];
  currency: string | null;
  editing: boolean;
  onChange: (items: InstallmentInput[]) => void;
};

// R20: "Is there an ongoing installment on this card?" on the card form. Each one asks what the
// statement line shows ("INST 03/10 ₱2,000"), never the unbilled remainder.
export function InstallmentFields({ on, onToggle, items, errors, currency, editing, onChange }: Props) {
  const set = (i: number, patch: Partial<InstallmentInput>) => onChange(items.map((it, n) => (n === i ? { ...it, ...patch } : it)));
  const err = (i: number, k: keyof InstallmentErrors) => (errors[i]?.[k] ? <Text style={styles.error}>{errors[i][k]}</Text> : null);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>Is there an ongoing installment on this card?</Text>
      <View style={styles.chips}>
        <Chip label="No" selected={!on} onPress={() => onToggle(false)} />
        <Chip
          label="Yes"
          selected={on}
          onPress={() => {
            if (items.length === 0) onChange([{ ...EMPTY_INSTALLMENT }]);
            onToggle(true);
          }}
        />
      </View>
      {on ? (
        <>
          {items.map((it, i) => (
            <View key={it.id ?? `new-${i}`} style={styles.item}>
              <View style={styles.itemHead}>
                <Text style={styles.itemTitle}>{it.name.trim() || `Installment ${i + 1}`}</Text>
                <Button variant="link" label="Remove" accessibilityLabel={`Remove installment ${i + 1}`} onPress={() => onChange(items.filter((_, n) => n !== i))} />
              </View>
              <View style={styles.cell}>
                <TextField label="What for? (optional)" value={it.name} onChangeText={(name) => set(i, { name })} placeholder="e.g. Phone" maxLength={30} />
                {err(i, 'name')}
              </View>
              <View style={styles.cell}>
                {currency ? (
                  <MoneyField
                    label="Monthly amount"
                    prefix={currencySymbol(currency)}
                    currency={currency}
                    value={it.amount}
                    onChangeText={(amount) => set(i, { amount })}
                    placeholder="0"
                  />
                ) : null}
                {err(i, 'amount')}
              </View>
              <View style={styles.row}>
                <View style={styles.cell}>
                  <TextField label="Statement shows" value={it.billed} onChangeText={(billed) => set(i, { billed })} keyboardType="number-pad" placeholder="3" />
                  {err(i, 'billed')}
                </View>
                <View style={styles.cell}>
                  <TextField label="Out of" value={it.total} onChangeText={(total) => set(i, { total })} keyboardType="number-pad" placeholder="10" />
                  {err(i, 'total')}
                </View>
              </View>
              <Text style={styles.hint}>
                “INST 03/10” on your statement → 3 out of 10. New and not on a statement yet? Enter 0.
                {editing && !it.id ? ' If it’s already on your latest statement, we take it out of the card balance.' : ''}
              </Text>
            </View>
          ))}
          <Button variant="link" label="+ Add another installment" onPress={() => onChange([...items, { ...EMPTY_INSTALLMENT }])} />
        </>
      ) : null}
    </View>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  group: { gap: space.sm },
  label: { ...type.label, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  item: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: space.md, borderWidth: 1, borderColor: colors.line },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  itemTitle: { ...type.rowTitleSm, color: colors.ink, flexShrink: 1 },
  row: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1, gap: space.xs },
  error: { ...type.caption, color: colors.danger },
  hint: { ...type.small, color: colors.muted },
});
