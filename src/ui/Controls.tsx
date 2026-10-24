import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

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
};

export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  return (
    <View style={styles.segments} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            // 30px visually, 44px to touch (DESIGN.md §1).
            hitSlop={{ top: 7, bottom: 7 }}
            style={[styles.segment, on && styles.segmentOn]}
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

type FieldProps = TextInputProps & { label: string };

/** Labelled text input (label 13/700 above a 48px box). */
export function TextField({ label, style, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[styles.input, style]} {...input} />
    </View>
  );
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
});
