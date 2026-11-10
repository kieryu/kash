import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { CheckIcon, ChevronDownIcon } from './icons';

export type SelectOption<T extends string> = { value: T; label: string; /** Small color dot before the label. */ color?: string };

type Props<T extends string> = {
  label: string;
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** R16: dropdown field. Looks like a TextField; tapping opens a bottom sheet with the options. */
export function SelectField<T extends string>({ label, options, value, onChange, disabled }: Props<T>) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'none'}`}
        accessibilityHint="Opens a list to choose from"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.box, pressed && styles.pressed, disabled && styles.disabled]}
      >
        {current?.color ? <View style={[styles.dot, { backgroundColor: current.color }]} /> : null}
        <Text style={styles.value} numberOfLines={1}>
          {current?.label ?? ''}
        </Text>
        <ChevronDownIcon size={20} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={styles.modal}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.scrim} />
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
            <View style={styles.handle} />
            <Text accessibilityRole="header" style={styles.title}>
              {label}
            </Text>
            <ScrollView accessibilityRole="radiogroup" style={styles.list}>
              {options.map((o) => {
                const on = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={o.label}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.pressed]}
                  >
                    {o.color ? <View style={[styles.dot, { backgroundColor: o.color }]} /> : null}
                    <Text style={[styles.rowText, on && styles.rowTextOn]}>{o.label}</Text>
                    {on ? <CheckIcon size={20} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const { colors, opacity, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...type.label, color: colors.muted },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: size.input,
    borderRadius: radius.input,
    borderWidth: size.border,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  value: { ...type.input, color: colors.ink, flex: 1 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  modal: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.ink, opacity: opacity.scrim },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.md, paddingHorizontal: space.lg, maxHeight: '75%' },
  handle: { alignSelf: 'center', width: size.sheetHandleWidth, height: size.sheetHandleHeight, borderRadius: radius.pill, backgroundColor: colors.handle, marginBottom: space.md },
  title: { ...type.sheetTitle, color: colors.ink, marginBottom: space.sm },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.input },
  rowOn: { backgroundColor: colors.primarySoft },
  rowText: { ...type.body, color: colors.ink, flex: 1 },
  rowTextOn: { ...type.label, color: colors.primary },
});
