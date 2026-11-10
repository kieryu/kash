import type { ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle> };

/**
 * R12: keeps inputs and the pinned footer button above the keyboard.
 * 'padding' on both platforms: Android runs edge-to-edge (SDK 54+), so the window no longer
 * resizes for the keyboard and the old `undefined` behavior left fields hidden behind it.
 */
export function KeyboardAvoid({ children, style }: Props) {
  return (
    <KeyboardAvoidingView style={[styles.fill, style]} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
