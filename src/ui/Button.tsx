import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '@/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** primary 56 tall · secondary 52 outlined · compact 44 (inside cards) · link (text only). */
  variant?: 'primary' | 'secondary' | 'compact' | 'link';
  /** Text color for `link`, e.g. white on the green lock screen. */
  color?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', color, disabled, accessibilityLabel }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles[variant], pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[variant === 'compact' ? styles.compactText : styles.text, textColor[variant], color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

type IconButtonProps = { accessibilityLabel: string; onPress: () => void; children: ReactNode };

/** 44×44 touch target around an icon (back arrow, close). */
export function IconButton({ accessibilityLabel, onPress, children }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

type ChipProps = { label: string; selected?: boolean; onPress: () => void };

/** Pill choice, e.g. the quick amounts in the payment sheet. */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const { colors, radius, size, space, type } = theme;

const center = { alignItems: 'center', justifyContent: 'center' } as const;

const textColor = {
  primary: { color: colors.onPrimary },
  compact: { color: colors.onPrimary },
  secondary: { color: colors.primary },
  link: { color: colors.primary },
};

const styles = StyleSheet.create({
  primary: { ...center, height: size.buttonPrimary, borderRadius: radius.button, backgroundColor: colors.primary },
  secondary: {
    ...center,
    height: size.buttonSecondary,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: size.border,
    borderColor: colors.lineStrong,
  },
  compact: { ...center, height: size.hitTarget, borderRadius: radius.input, backgroundColor: colors.primary },
  link: { ...center, minHeight: size.hitTarget, padding: space.md },
  text: type.button,
  compactText: type.rowTitle,
  icon: { ...center, width: size.hitTarget, height: size.hitTarget, borderRadius: radius.input },
  chip: {
    ...center,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: size.border,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.chip, color: colors.ink },
  chipTextOn: { color: colors.onPrimary },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
