import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Switch } from './Controls';
import { CheckIcon } from './icons';

// 12 Settings building blocks (design/mockups/Settings.dc.html). Presentational (D20).

/** Uppercase title over a white card of rows. Rows draw their own top divider, except the first. */
export function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

type RowProps = {
  label: string;
  hint?: string;
  /** Amber hint, e.g. "Last backup: never". */
  hintTone?: 'muted' | 'warn';
  value?: string;
  right?: ReactNode;
  first?: boolean;
  danger?: boolean;
  onPress?: () => void;
  expanded?: boolean;
};

export function Row({ label, hint, hintTone = 'muted', value, right, first, danger, onPress, expanded }: RowProps) {
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={danger ? styles.danger : styles.label}>{label}</Text>
        {hint ? <Text style={hintTone === 'warn' ? styles.hintWarn : styles.hint}>{hint}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {right}
    </>
  );
  const style = [styles.row, !first && styles.rowLine];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

type SwitchRowProps = { label: string; hint: string; value: boolean; onChange: (v: boolean) => void; first?: boolean };

export function SwitchRow({ label, hint, value, onChange, first }: SwitchRowProps) {
  return <Row label={label} hint={hint} first={first} right={<Switch value={value} onValueChange={onChange} accessibilityLabel={label} />} />;
}

type ChoicesProps<T> = { options: readonly { value: T; label: string }[]; selected: T; onPick: (v: T) => void };

/** Radio list shown under a row when it's tapped open. */
export function Choices<T extends string | number>({ options, selected, onPick }: ChoicesProps<T>) {
  return (
    <View accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === selected;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onPick(o.value)}
            style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
          >
            <Text style={on ? styles.choiceOn : styles.choiceText}>{o.label}</Text>
            {on ? <CheckIcon size={18} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const { colors, size, space, type } = theme;

const styles = StyleSheet.create({
  section: { gap: space.sm },
  sectionTitle: { ...type.overline, color: colors.muted, textTransform: 'uppercase', marginHorizontal: space.xs },
  card: { backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: space.lg },
  note: { ...type.caption, color: colors.muted, paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 56, paddingVertical: space.sm },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowText: { flexShrink: 1, gap: 2 },
  label: { ...type.settingLabel, color: colors.ink },
  danger: { ...type.rowTitle, color: colors.danger },
  hint: { ...type.caption, color: colors.muted },
  hintWarn: { ...type.captionBold, color: colors.accentLabel },
  value: { ...type.bodySm, color: colors.muted, flexShrink: 1, textAlign: 'right' },
  choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: size.hitTarget, paddingLeft: space.md },
  choiceText: { ...type.bodySm, color: colors.ink },
  choiceOn: { ...type.rowTitleSm, color: colors.primary },
  pressed: { opacity: 0.85 },
});
