import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Button, IconButton } from './Button';
import { BackIcon, DeleteIcon, FingerprintIcon } from './icons';

const PIN_LENGTH = 4;

type Props = {
  /** 'primary' = green unlock screen; 'light' = setup / change PIN. */
  tone: 'primary' | 'light';
  title: string;
  subtitle?: string;
  message?: string | null;
  disabled?: boolean;
  /** Called with the full PIN; the dots clear once it resolves. */
  onComplete: (pin: string) => Promise<void> | void;
  onBack?: () => void;
  onBiometrics?: () => void;
  onForgot?: () => void;
};

export function PinPad({ tone, title, subtitle, message, disabled, onComplete, onBack, onBiometrics, onForgot }: Props) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const c = tone === 'primary' ? toneColors.primary : toneColors.light;
  const locked = disabled || busy;

  const press = async (d: string) => {
    if (locked || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    setBusy(true);
    try {
      await onComplete(next);
    } finally {
      setPin('');
      setBusy(false);
    }
  };

  const key = (d: string) => (
    <Pressable
      key={d}
      accessibilityRole="button"
      accessibilityLabel={d}
      disabled={locked}
      onPress={() => press(d)}
      style={({ pressed }) => [styles.key, { backgroundColor: c.key }, pressed && styles.pressed, locked && styles.dim]}
    >
      <Text maxFontSizeMultiplier={1.5} style={[styles.keyText, { color: c.keyText }]}>{d}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.top}>
        {onBack && (
          <IconButton accessibilityLabel="Back" onPress={onBack}>
            <BackIcon size={24} color={c.text} />
          </IconButton>
        )}
      </View>

      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: c.muted }]}>{subtitle}</Text> : null}
        <View style={styles.dots} accessible accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <View key={i} style={[styles.dot, { borderColor: c.text }, i < pin.length && { backgroundColor: c.text }]} />
          ))}
        </View>
        <Text style={[styles.message, { color: c.muted }]} accessibilityLiveRegion="polite">
          {message ?? ' '}
        </Text>
      </View>

      <View style={styles.pad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row) => (
          <View key={row[0]} style={styles.row}>
            {row.map(key)}
          </View>
        ))}
        <View style={styles.row}>
          {onBiometrics ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Unlock with fingerprint or face"
              onPress={onBiometrics}
              style={({ pressed }) => [styles.key, pressed && styles.pressed]}
            >
              <FingerprintIcon size={32} color={c.text} />
            </Pressable>
          ) : (
            <View style={styles.key} />
          )}
          {key('0')}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete digit"
            disabled={locked || pin.length === 0}
            onPress={() => setPin((p) => p.slice(0, -1))}
            style={({ pressed }) => [styles.key, pressed && styles.pressed]}
          >
            <DeleteIcon size={28} color={c.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        {onForgot && <Button variant="link" color={c.text} label="Forgot your PIN?" onPress={onForgot} />}
      </View>
    </SafeAreaView>
  );
}

const { colors, space, size, type } = theme;

const toneColors = {
  primary: { bg: colors.primary, text: colors.onPrimary, muted: colors.onPrimaryMuted, key: colors.primaryRaised, keyText: colors.onPrimary },
  light: { bg: colors.bg, text: colors.ink, muted: colors.muted, key: colors.surface, keyText: colors.ink },
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.screenOnboarding },
  top: { minHeight: size.hitTarget, justifyContent: 'center' },
  header: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  title: { ...type.title, textAlign: 'center' },
  subtitle: { ...type.body, textAlign: 'center', maxWidth: 300 },
  dots: { flexDirection: 'row', gap: space.xl, paddingVertical: space.lg },
  dot: { width: size.pinDot, height: size.pinDot, borderRadius: size.pinDot / 2, borderWidth: size.border },
  message: { ...type.bodySm, textAlign: 'center', minHeight: 40 },
  pad: { gap: space.lg, paddingBottom: space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-evenly' },
  key: { width: size.pinKey, height: size.pinKey, borderRadius: size.pinKey / 2, alignItems: 'center', justifyContent: 'center' },
  keyText: type.pinKey,
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.5 },
  footer: { minHeight: size.buttonPrimary, alignItems: 'center', justifyContent: 'center' },
});
