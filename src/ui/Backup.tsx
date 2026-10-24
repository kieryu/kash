import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Button, IconButton } from './Button';
import { TextField } from './Controls';
import { BackIcon } from './icons';

type Props = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content (buttons). */
  footer?: ReactNode;
};

/** Back-arrow screen: 20/700 header, scrolling content, pinned footer. */
export function BackScreen({ title, onBack, children, footer }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" onPress={onBack}>
          <BackIcon size={24} color={colors.ink} />
        </IconButton>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/** Amber tip / warning box (accentSoft). */
export function Note({ children }: { children: ReactNode }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

type PasswordProps = { label: string; value: string; onChangeText: (v: string) => void; editable?: boolean };

/** Secure text field with a Show/Hide link: typos in a password you can't reset are costly. */
export function PasswordField({ label, value, onChangeText, editable = true }: PasswordProps) {
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.passwordRow}>
      <View style={styles.grow}>
        <TextField
          label={label}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          importantForAutofill="no"
        />
      </View>
      <Button
        variant="link"
        label={shown ? 'Hide' : 'Show'}
        accessibilityLabel={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        onPress={() => setShown(!shown)}
      />
    </View>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingTop: space.sm },
  title: { ...type.screenHeader, color: colors.ink },
  content: { padding: space.screenApp, gap: space.lg },
  footer: { paddingHorizontal: space.screenApp, paddingBottom: space.xxl, paddingTop: space.md, gap: space.md },
  note: { backgroundColor: colors.accentSoft, borderRadius: radius.input, padding: space.md },
  noteText: { ...type.small, color: colors.accentText },
  passwordRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  grow: { flex: 1 },
});
