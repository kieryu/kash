import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BILLING_MESSAGES, buyPro, PRO_PRICE, restorePro, type BillingResult } from '@/billing/billing';
import { lastBillingError, playStore } from '@/billing/playStore';
import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { getEntitlement } from '@/db/repositories/settings';
import { theme } from '@/theme';
import { Button, IconButton } from '@/ui/Button';
import { CheckBadge, CloseIcon } from '@/ui/icons';
import { Mascot } from '@/ui/Mascot';

// Only list what works today as "included"; the rest is labelled as coming so we never sell an unbuilt feature (D32).
const FEATURES = ['Unlimited debts (free: 3)'];
const COMING = [
  'Highest-cost and Hybrid strategies',
  'What-if simulator',
  'Charts and full timeline',
  'Multiple currencies',
  'Home-screen widget and extra card styles',
];

// 13 Kash Pro. Opened only when the user taps something Pro, never on its own, so it can't nag (§20).
// Root route (not under (app)) so onboarding's strategy screen can open it too.
export default function Pro() {
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [price, setPrice] = useState(PRO_PRICE);

  useEffect(() => {
    getAppDb().then((db) => setIsPro(getEntitlement(db).isPro));
    // Play's price in the user's currency; keep the default if Play can't be reached.
    playStore
      .price()
      .then((p) => p && setPrice(p))
      .catch(() => {});
  }, []);

  const run = async (action: typeof buyPro) => {
    setBusy(true);
    setMessage(null);
    try {
      const r: BillingResult = await action(await getAppDb(), playStore);
      if (r === 'unlocked') setIsPro(true);
      // Play's reason helps testers report what went wrong (codes only, no personal data).
      else if (r === 'failed') setMessage(`${BILLING_MESSAGES.failed}\n\nGoogle Play said: ${lastBillingError() ?? 'unknown'}`);
      else setMessage(BILLING_MESSAGES[r]);
    } catch {
      setMessage(BILLING_MESSAGES.failed);
    } finally {
      setBusy(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (isPro === null) return null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Close" onPress={close}>
          <CloseIcon size={22} color={colors.ink} />
        </IconButton>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Mascot mood="cheer" size={110} />
          <Text accessibilityRole="header" style={styles.h1}>
            {APP_NAME} Pro
          </Text>
          {isPro ? (
            <Text style={styles.lead}>
              <Text style={styles.leadStrong}>You have {APP_NAME} Pro.</Text> Thank you for supporting {APP_NAME}.
            </Text>
          ) : (
            <Text style={styles.lead}>
              <Text style={styles.leadStrong}>{price} one time.</Text> No subscription, no ads.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          {FEATURES.map((f, i) => (
            <View key={f} style={[styles.feature, i < FEATURES.length - 1 && styles.featureLine]}>
              <CheckBadge size={22} color={colors.primarySoft} checkColor={colors.primary} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.comingCard}>
          <Text accessibilityRole="header" style={styles.comingTitle}>
            Coming in free updates for Pro
          </Text>
          {COMING.map((f) => (
            <Text key={f} style={styles.comingText}>
              {'•'} {f}
            </Text>
          ))}
        </View>

        <View style={styles.free}>
          <Text style={styles.freeText}>
            <Text style={styles.freeStrong}>Always free:</Text> your full payoff plan, reminders, encryption and backups. Your
            data is never locked.
          </Text>
        </View>

        {message ? (
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {isPro ? (
          <Button label="Done" onPress={close} />
        ) : (
          <>
            <Button variant="accent" label={busy ? 'One moment…' : `Unlock for ${price}`} disabled={busy} onPress={() => run(buyPro)} />
            <Button variant="link" label="Maybe later" onPress={close} />
            <Text accessibilityRole="button" accessibilityState={{ disabled: busy }} style={styles.restore} onPress={busy ? undefined : () => run(restorePro)}>
              Restore purchase
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const { colors, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.lg },
  content: { paddingHorizontal: space.screenOnboarding, gap: 18, paddingBottom: space.lg },
  top: { alignItems: 'center', gap: 10 },
  h1: { ...type.h1, color: colors.ink },
  lead: { ...type.input, color: colors.muted, textAlign: 'center' },
  leadStrong: { ...type.button, color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: radius.cardLg - 2, paddingVertical: 6, paddingHorizontal: space.lg },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 46 },
  featureLine: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  featureText: { ...type.body, color: colors.ink, flexShrink: 1 },
  comingCard: { borderRadius: radius.cardLg - 2, borderWidth: 1.5, borderColor: colors.lineStrong, borderStyle: 'dashed', paddingVertical: 14, paddingHorizontal: space.lg, gap: 6 },
  comingTitle: { ...type.rowTitleSm, color: colors.muted },
  comingText: { ...type.bodySm, color: colors.muted },
  free: { backgroundColor: colors.primarySoft, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: space.lg },
  freeText: { ...type.bodySm, color: colors.onPrimarySoft },
  freeStrong: { ...type.rowTitleSm, color: colors.onPrimarySoft },
  message: { ...type.small, color: colors.accentText, textAlign: 'center' },
  footer: { paddingHorizontal: space.screenOnboarding, paddingTop: space.lg, paddingBottom: space.xxl, gap: 6 },
  restore: { ...type.small, color: colors.muted, textDecorationLine: 'underline', textAlign: 'center', minHeight: size.hitTarget, textAlignVertical: 'center', paddingVertical: space.md },
});
