import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config/app';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';

// Original lines; one is picked per launch.
const LINES = [
  'Every peso you pay is one step closer to zero.',
  'Small payments, made often, add up to freedom.',
  'You don’t have to be fast. You just have to keep going.',
  'Today’s payment is a gift to future you.',
];

// 01 Splash.
export default function Welcome() {
  const [line] = useState(() => LINES[Math.floor(Math.random() * LINES.length)]);
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false}>
        <View style={styles.halo}>
          <Mascot mood="watch" size={180} />
        </View>
        <View style={styles.brand}>
          <Text style={styles.wordmark}>{APP_NAME}</Text>
          <Text style={styles.tagline}>Your path to debt-free</Text>
        </View>
        <Text style={styles.line}>“{line}”</Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button variant="accent" label="Get started" onPress={() => router.push('/privacy')} />
        <Text style={styles.note}>No account needed · Works offline</Text>
      </View>
    </SafeAreaView>
  );
}

const { colors, size, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary, paddingHorizontal: 28, paddingBottom: space.xxl },
  center: { flexGrow: 1, paddingVertical: space.lg, alignItems: 'center', justifyContent: 'center', gap: 28 },
  halo: {
    width: size.lockHalo + 28,
    height: size.lockHalo + 28,
    borderRadius: (size.lockHalo + 28) / 2,
    backgroundColor: colors.primaryRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { alignItems: 'center', gap: space.sm },
  wordmark: { ...type.wordmark, color: colors.onPrimary },
  tagline: { ...type.body, color: colors.onPrimaryMuted },
  line: { ...type.quote, color: colors.onPrimary, textAlign: 'center', maxWidth: 290, marginTop: space.md },
  footer: { gap: space.lg, alignItems: 'stretch' },
  note: { ...type.small, color: colors.onPrimaryMuted, textAlign: 'center' },
});
