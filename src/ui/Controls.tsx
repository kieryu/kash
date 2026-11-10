import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { amountEdit } from '@/domain/format';
import { theme } from '@/theme';

type SwitchProps = { value: boolean; onValueChange: (next: boolean) => void; accessibilityLabel: string; disabled?: boolean };

export function Switch({ value, onValueChange, accessibilityLabel, disabled }: SwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      style={[styles.track, value ? styles.trackOn : styles.trackOff, disabled && styles.disabled]}
    >
      <View style={styles.knob} />
    </Pressable>
  );
}

type SegmentedProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** Locked: shows the value, ignores taps. */
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel, disabled }: SegmentedProps<T>) {
  return (
    <View style={styles.segments} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on, disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            // 30px visually, 44px to touch (DESIGN.md §1).
            hitSlop={{ top: 7, bottom: 7 }}
            style={[styles.segment, on && styles.segmentOn, disabled && !on && styles.segmentLocked]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.segmentText, on && styles.segmentTextOn]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type ProgressProps = {
  /** 0–1. */
  value: number;
  /** hero = amber on green (8px); card = white on translucent (4px). */
  tone: 'hero' | 'card';
  accessibilityLabel?: string;
};

export function ProgressBar({ value, tone, accessibilityLabel }: ProgressProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const hero = tone === 'hero';
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.bar, hero ? styles.barHero : styles.barCard]}
    >
      <View style={[StyleSheet.absoluteFill, hero ? styles.trackHero : styles.trackCard]} />
      <View style={[styles.fill, { width: `${pct}%` }, hero ? styles.fillHero : styles.fillCard]} />
    </View>
  );
}

type FieldProps = TextInputProps & { label: string; /** Shown inside the box on the left, e.g. "₱". */ prefix?: string };

/** Labelled text input (label 13/700 above a 48px box). */
export function TextField({ label, prefix, style, ...input }: FieldProps) {
  const field = (
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={prefix ? [styles.prefixed, style] : [styles.input, style]} {...input} />
  );
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {prefix ? (
        <View style={[styles.input, styles.prefixRow]}>
          <Text style={styles.prefix} importantForAccessibility="no" accessibilityElementsHidden>
            {prefix}
          </Text>
          {field}
        </View>
      ) : (
        field
      )}
    </View>
  );
}

/**
 * Typing props for an amount input (R19): thousands commas while typing, and the cursor stays next to
 * the digit just typed when commas shift. Selection events from the same keystroke are pinned to that
 * spot, whichever order the platform sends them in.
 */
export function useMoneyInput(value: string, currency: string, onChangeText: (text: string) => void) {
  const [sel, setSel] = useState<{ start: number; end: number }>();
  const pinned = useRef<number | null>(null);
  const clamp = (n: number) => Math.min(n, value.length);
  return {
    value,
    keyboardType: 'decimal-pad' as const,
    selection: sel && { start: clamp(sel.start), end: clamp(sel.end) },
    onSelectionChange: (e: { nativeEvent: { selection: { start: number; end: number } } }) => {
      const p = pinned.current;
      setSel(p === null ? e.nativeEvent.selection : { start: p, end: p });
    },
    onChangeText: (raw: string) => {
      const { text, caret } = amountEdit(value, raw, currency);
      pinned.current = caret;
      setSel({ start: caret, end: caret });
      requestAnimationFrame(() => {
        pinned.current = null;
      });
      onChangeText(text);
    },
  };
}

type MoneyFieldProps = Omit<FieldProps, 'value' | 'onChangeText' | 'selection' | 'onSelectionChange'> & {
  value: string;
  currency: string;
  onChangeText: (text: string) => void;
};

/** Labelled amount input with the currency sign as `prefix` (R19). */
export function MoneyField({ value, currency, onChangeText, ...field }: MoneyFieldProps) {
  return <TextField {...field} {...useMoneyInput(value, currency, onChangeText)} />;
}

const { colors, radius, size, type } = theme;
const knob = size.switchHeight - 6;

const styles = StyleSheet.create({
  track: { width: size.switchWidth, height: size.switchHeight, borderRadius: radius.pill, padding: 3 },
  trackOn: { backgroundColor: colors.primary, alignItems: 'flex-end' },
  trackOff: { backgroundColor: colors.switchOff, alignItems: 'flex-start' },
  knob: { width: knob, height: knob, borderRadius: knob / 2, backgroundColor: colors.surface },
  disabled: { opacity: 0.5 },

  segments: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: 11, backgroundColor: colors.segmentBg },
  segment: { flex: 1, minHeight: size.segment, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.primary },
  segmentLocked: { opacity: 0.5 },
  segmentText: { ...type.segment, color: colors.ink },
  segmentTextOn: { ...type.label, color: colors.onPrimary },

  bar: { overflow: 'hidden', borderRadius: radius.pill },
  barHero: { height: size.progressBar },
  barCard: { height: size.progressBar / 2 },
  trackHero: { backgroundColor: colors.primaryTrack },
  trackCard: { backgroundColor: colors.onPrimary, opacity: 0.3 },
  fill: { height: '100%', borderRadius: radius.pill },
  fillHero: { backgroundColor: colors.accent },
  fillCard: { backgroundColor: colors.onPrimary },

  field: { gap: 6 },
  label: { ...type.label, color: colors.muted },
  input: {
    ...type.input,
    minHeight: size.input,
    borderRadius: radius.input,
    borderWidth: size.border,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  prefixRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prefix: { ...type.input, color: colors.muted },
  prefixed: { ...type.input, flex: 1, minHeight: size.input - 2 * size.border, padding: 0, color: colors.ink },
});
