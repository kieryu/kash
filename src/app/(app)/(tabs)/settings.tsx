import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatBackupDate } from '@/backup/preview';
import { BILLING_MESSAGES, PRO_PRICE, restorePro } from '@/billing/billing';
import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { getEntitlement, getSettings, setEntitlement, updateSettings } from '@/db/repositories/settings';
import type { Settings as SettingsRow } from '@/db/schema';
import { runDbSelfCheck, type CheckStep } from '@/dev/dbSelfCheck';
import { CURRENCIES, currencyName, relabelHomeCurrency } from '@/domain/currency';
import { currencySymbol } from '@/domain/dashboard';
import { rescheduleReminders } from '@/notifications/reminders';
import { getLockState, setBiometrics, setWipeAfter, WIPE_AFTER, type LockState } from '@/security/pin';
import { deleteAllData } from '@/security/wipe';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { ChevronIcon } from '@/ui/icons';
import { Mascot } from '@/ui/Mascot';
import { Choices, Row, Section, SwitchRow } from '@/ui/Settings';

const LOCK_TIMEOUTS = [
  { value: 0, label: 'Immediately' },
  { value: 60, label: 'After 1 minute' },
  { value: 300, label: 'After 5 minutes' },
  { value: 900, label: 'After 15 minutes' },
] as const;

const REMINDER_DAYS = [
  { value: 0, label: 'On the day only' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '7 days before' },
] as const;

type Open = 'lock' | 'currency' | 'reminders' | null;

const label = <T,>(list: readonly { value: T; label: string }[], v: T) => list.find((o) => o.value === v)?.label ?? String(v);
const currencyText = (code: string) => `${currencySymbol(code)} ${code} · ${currencyName(code)}`;

// 12 Settings.
export default function Settings() {
  const [s, setS] = useState<SettingsRow | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [lock, setLock] = useState<LockState | null>(null);
  const [open, setOpen] = useState<Open>(null);

  const refresh = useCallback(() => {
    getLockState().then(setLock);
    getAppDb().then((db) => {
      setS(getSettings(db));
      setIsPro(getEntitlement(db).isPro);
    });
  }, []);
  useFocusEffect(refresh);

  if (!s || !lock) return null;

  const save = async (patch: Partial<Omit<SettingsRow, 'id'>>) => {
    updateSettings(await getAppDb(), patch);
    refresh();
  };
  const toggle = (o: Open) => setOpen(open === o ? null : o);

  const toggleBiometrics = async (on: boolean) => {
    if (on) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on biometric lock' });
      if (!r.success) return;
      await setBiometrics(true);
      return refresh();
    }
    const off = async () => {
      await setBiometrics(false);
      refresh();
    };
    if (lock.pin) return off();
    Alert.alert('Turn off the app lock?', `You have no ${APP_NAME} PIN, so anyone holding your unlocked phone could open ${APP_NAME}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Turn off', style: 'destructive', onPress: off },
    ]);
  };

  const toggleScreenshots = async (on: boolean) => {
    await (on ? ScreenCapture.preventScreenCaptureAsync() : ScreenCapture.allowScreenCaptureAsync());
    save({ blockScreenshots: on });
  };

  const toggleWipe = (on: boolean) => {
    const apply = async () => {
      await setWipeAfter(on ? WIPE_AFTER : null);
      refresh();
    };
    if (!on) return apply();
    Alert.alert(
      `Erase after ${WIPE_AFTER} wrong PINs?`,
      `After ${WIPE_AFTER} wrong PINs in a row, ${APP_NAME} deletes all your debts and history on this phone. This can’t be undone — only a backup file brings it back. Anyone holding your phone could also trigger it on purpose.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn on', style: 'destructive', onPress: apply },
      ],
    );
  };

  const pickReminders = async (days: number) => {
    const db = await getAppDb();
    updateSettings(db, { reminderDaysBefore: days });
    rescheduleReminders(db).catch(() => {});
    setOpen(null);
    refresh();
  };

  const pickCurrency = (code: string) => {
    setOpen(null);
    if (code === s.homeCurrency) return;
    const relabel = async () => {
      const r = relabelHomeCurrency(await getAppDb(), code);
      if (r === 'different_decimals') {
        Alert.alert(
          'Can’t switch to that currency yet',
          `${code} uses a different number of decimals than ${s.homeCurrency}, so your amounts can’t simply be relabelled. Pick a currency with the same decimals.`,
        );
      }
      refresh();
    };
    Alert.alert(`Change home currency to ${code}?`, 'Why are you changing it?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'I moved / want totals in another currency',
        onPress: () =>
          Alert.alert(
            'Not available yet',
            'Converting your totals at an exchange rate comes in a later update. Nothing was changed.',
          ),
      },
      { text: 'I picked the wrong currency', onPress: relabel },
    ]);
  };

  const restore = async () => {
    const r = await restorePro(await getAppDb());
    if (r === 'unlocked') return refresh();
    const msg = BILLING_MESSAGES[r];
    if (msg) Alert.alert('Restore purchase', msg);
  };

  const deleteAll = () => {
    const run = async () => {
      try {
        await deleteAllData();
        router.replace('/welcome');
      } catch {
        Alert.alert('Couldn’t delete', 'Your data is still on this phone. Close the app and try again.');
      }
    };
    Alert.alert(
      'Delete all data?',
      `This deletes every debt, payment and setting on this phone, and your ${APP_NAME} PIN. It can’t be undone. Export a backup first if you might want it back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'Everything will be gone for good.', [
              { text: 'Keep my data', style: 'cancel' },
              { text: 'Delete everything', style: 'destructive', onPress: run },
            ]),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text accessibilityRole="header" style={styles.title}>
        Settings
      </Text>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isPro ? null : (
          <Pressable accessibilityRole="button" onPress={() => router.push('/pro')} style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
            <Mascot mood="cheer" size={52} />
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>Unlock {APP_NAME} Pro</Text>
              <Text style={styles.bannerSub}>{PRO_PRICE} one time · no subscription</Text>
            </View>
            <ChevronIcon size={20} color={colors.onPrimary} />
          </Pressable>
        )}

        <Section title="Privacy & security">
          <SwitchRow first label="Biometric unlock" hint="Fingerprint or face" value={lock.biometrics} onChange={toggleBiometrics} />
          <SwitchRow label="Hide balances" hint="Tap to reveal amounts" value={s.hideBalances} onChange={(v) => save({ hideBalances: v })} />
          <SwitchRow label="Block screenshots" hint={`Also hides ${APP_NAME} in recent apps`} value={s.blockScreenshots} onChange={toggleScreenshots} />
          <Row label="Auto-lock" value={label(LOCK_TIMEOUTS, s.lockTimeoutSec)} expanded={open === 'lock'} onPress={() => toggle('lock')} />
          {open === 'lock' ? (
            <Choices
              options={LOCK_TIMEOUTS}
              selected={s.lockTimeoutSec}
              onPick={(v) => {
                setOpen(null);
                save({ lockTimeoutSec: v });
              }}
            />
          ) : null}
          <Row label={lock.pin ? 'Change PIN' : 'Set a PIN'} value={lock.pin ? '••••' : 'Not set'} onPress={() => router.push('/pin-setup')} />
          {lock.pin ? (
            <SwitchRow
              label={`Erase after ${WIPE_AFTER} wrong PINs`}
              hint="Deletes all data on this phone"
              value={lock.wipeAfter != null}
              onChange={toggleWipe}
            />
          ) : null}
        </Section>

        <Section title="Money">
          <Row first label="Home currency" value={currencyText(s.homeCurrency)} expanded={open === 'currency'} onPress={() => toggle('currency')} />
          {open === 'currency' ? (
            <Choices options={CURRENCIES.map((c) => ({ value: c.code, label: currencyText(c.code) }))} selected={s.homeCurrency} onPick={pickCurrency} />
          ) : null}
          <Row label="Due-date reminders" value={label(REMINDER_DAYS, s.reminderDaysBefore)} expanded={open === 'reminders'} onPress={() => toggle('reminders')} />
          {open === 'reminders' ? <Choices options={REMINDER_DAYS} selected={s.reminderDaysBefore} onPick={pickReminders} /> : null}
        </Section>

        <Section title="Your data" note={`Backups move your data to a new phone one time. ${APP_NAME} does not sync between devices.`}>
          <Row
            first
            label="Export encrypted backup"
            hint={`Last backup: ${s.lastBackupAt ? formatBackupDate(s.lastBackupAt) : 'never'}`}
            hintTone={s.lastBackupAt ? 'muted' : 'warn'}
            right={<Button variant="compact" label="Export" onPress={() => router.push('/backup/export')} />}
          />
          <Row label="Import a backup" value="Replaces this phone’s data" onPress={() => router.push('/backup/import')} />
          <Row label="Delete all data" danger onPress={deleteAll} />
        </Section>

        <Section title={`${APP_NAME} Pro`}>
          <Row first label={isPro ? `${APP_NAME} Pro is unlocked` : 'Restore purchase'} hint={isPro ? 'Thank you' : 'Bought Pro before? Get it back here.'} onPress={isPro ? undefined : restore} />
        </Section>

        <Text style={styles.footer}>
          {APP_NAME} {Constants.expoConfig?.version ?? ''} · Not financial advice · Estimates only{'\n'}Not affiliated with any bank or card network
        </Text>

        {__DEV__ ? <DevTools isPro={isPro} onChange={refresh} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// Dev builds only: SQLCipher check and a test Pro switch for trying the gating.
function DevTools({ isPro, onChange }: { isPro: boolean; onChange: () => void }) {
  const [steps, setSteps] = useState<CheckStep[] | null>(null);
  const setPro = async (on: boolean) => {
    setEntitlement(await getAppDb(), { isPro: on, source: on ? 'test' : null, checkedAt: new Date().toISOString() });
    onChange();
  };
  return (
    <Section title="Developer">
      <SwitchRow first label="Pro (test)" hint="Dev builds only" value={isPro} onChange={setPro} />
      <Row label="Encrypted database check" value="Run" onPress={async () => setSteps(await runDbSelfCheck())} />
      {steps?.map((st) => <Row key={st.name} label={`${st.ok ? '✓' : '✗'} ${st.name}`} hint={st.detail ?? undefined} />)}
    </Section>
  );
}

const { colors, space, type } = theme;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.screenHeader, color: colors.ink, paddingHorizontal: space.screenApp, paddingTop: space.md, paddingBottom: space.sm },
  content: { paddingHorizontal: space.screenApp, paddingTop: space.xs, paddingBottom: space.xxl, gap: 18 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 14, paddingHorizontal: space.lg },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { ...type.button, color: colors.onPrimary },
  bannerSub: { ...type.small, color: colors.onPrimaryMuted },
  pressed: { opacity: 0.85 },
  footer: { ...type.caption, color: colors.muted, textAlign: 'center' },
});
