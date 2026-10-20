import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config/app';
import { runDbSelfCheck, type CheckStep } from '@/dev/dbSelfCheck';
import { theme } from '@/theme';

// Placeholder home for slice 0. Replaced by onboarding / dashboard in later slices.
export default function Index() {
  const [steps, setSteps] = useState<CheckStep[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      setSteps(await runDbSelfCheck());
    } finally {
      setRunning(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.wordmark}>{APP_NAME}</Text>
        <Text style={styles.body}>Development build · slice 0</Text>

        {__DEV__ && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Encrypted database check</Text>
            <Pressable
              accessibilityRole="button"
              onPress={run}
              disabled={running}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>{running ? 'Checking…' : 'Run check'}</Text>
            </Pressable>
            {steps?.map((s) => (
              <View key={s.name} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {s.ok ? '✓' : '✗'} {s.name}
                </Text>
                {s.detail ? <Text style={styles.caption}>{s.detail}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const { colors, space, radius, size, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.screenApp, gap: space.lg },
  wordmark: { ...type.wordmark, color: colors.primary },
  body: { ...type.body, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg, gap: space.md },
  sectionTitle: { ...type.sectionTitle, color: colors.ink },
  button: {
    height: size.buttonPrimary,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  buttonText: { ...type.button, color: colors.onPrimary },
  row: { gap: space.xs },
  rowTitle: { ...type.rowTitleSm, color: colors.ink },
  caption: { ...type.caption, color: colors.muted },
});
