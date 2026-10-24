import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Mascot } from './Mascot';

/** Stand-in for tabs that aren't built yet. */
export function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <SafeAreaView style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Mascot mood="think" size={96} />
      <Text style={styles.body}>{body}</Text>
    </SafeAreaView>
  );
}

const { colors, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.screenApp, gap: space.lg, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.screenHeader, color: colors.ink },
  body: { ...type.body, color: colors.muted, textAlign: 'center' },
});
