import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { readBackup, replaceAll, type BackupData } from '@/backup/backup';
import { backupSummary, formatBackupDate, importError, type BackupSummary } from '@/backup/preview';
import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { listDebts } from '@/db/repositories/debts';
import { rescheduleReminders } from '@/notifications/reminders';
import { theme } from '@/theme';
import { BackScreen, Note, PasswordField } from '@/ui/Backup';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';

type Step = 'pick' | 'password' | 'preview' | 'done';

// Import a backup and replace all data (CLAUDE.md §9, design/proposals/backup-import.md).
export default function ImportBackup() {
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [backup, setBackup] = useState<{ data: BackupData; summary: BackupSummary } | null>(null);

  const restart = (msg: string | null = null) => {
    setStep('pick');
    setFile(null);
    setPassword('');
    setBackup(null);
    setMessage(msg);
  };

  const pick = async () => {
    setMessage(null);
    try {
      const r = await File.pickFileAsync();
      if (r.canceled) return;
      setFile({ name: r.result.name, text: await r.result.text() });
      setStep('password');
    } catch {
      setMessage("Couldn’t open that file. Try picking it again.");
    }
  };

  const unlock = async () => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await readBackup(file.text, password);
      const phoneDebts = listDebts(await getAppDb(), { includeArchived: true }).length;
      setBackup({ data, summary: backupSummary(data, phoneDebts) });
      setPassword('');
      setStep('preview');
    } catch (e) {
      const err = importError(e);
      if (err.repick) restart(err.message);
      else setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const replace = async () => {
    if (!backup) return;
    setBusy(true);
    setMessage(null);
    try {
      const db = await getAppDb();
      replaceAll(db, backup.data);
      // Data is in; a reminder failure (e.g. notifications off) shouldn’t report the import as failed.
      await rescheduleReminders(db).catch(() => undefined);
      setBackup(null);
      setStep('done');
    } catch {
      setMessage("Couldn’t import. Your data on this phone wasn’t changed.");
    } finally {
      setBusy(false);
    }
  };

  const confirmReplace = () => {
    const n = backup?.summary.replaced ?? 0;
    if (n === 0) return replace();
    Alert.alert(
      'Replace all data?',
      `Your ${n} ${n === 1 ? 'debt' : 'debts'} and their history on this phone will be deleted. This can’t be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: replace },
      ],
    );
  };

  const back = () => {
    if (!busy) router.back();
  };

  const s = backup?.summary;

  return (
    <BackScreen
      title="Import backup"
      onBack={back}
      footer={
        step === 'pick' ? (
          <Button label="Choose file" onPress={pick} />
        ) : step === 'password' ? (
          <>
            <Button label={busy ? 'Unlocking…' : 'Unlock'} onPress={unlock} disabled={!password || busy} />
            <Button variant="link" label="Choose a different file" onPress={() => restart()} disabled={busy} />
          </>
        ) : step === 'preview' ? (
          <>
            <Button label="Replace all my data" onPress={confirmReplace} disabled={busy} />
            <Button variant="secondary" label="Cancel" onPress={() => restart()} disabled={busy} />
          </>
        ) : (
          <Button label="Go to my plan" onPress={() => router.dismissTo('/')} />
        )
      }
    >
      <View style={styles.center}>
        <Mascot mood={step === 'done' ? 'cheer' : step === 'preview' && !busy ? 'watch' : 'think'} size={96} />
      </View>

      {step === 'pick' ? (
        <>
          <View style={styles.head}>
            <Text style={styles.title}>Move your data to this phone</Text>
            <Text style={styles.body}>Pick the backup file you saved from your other phone.</Text>
          </View>
          <Note>Importing replaces everything on this phone. It doesn’t merge.</Note>
        </>
      ) : null}

      {step === 'password' && file ? (
        <View style={styles.head}>
          <Text style={styles.caption}>{file.name}</Text>
          <PasswordField label="Backup password" value={password} onChangeText={setPassword} editable={!busy} />
        </View>
      ) : null}

      {step === 'preview' && s ? (
        <>
          <Text style={styles.title}>Backup from {formatBackupDate(s.exportedAt)}</Text>
          <View style={styles.card}>
            <Row label="Debts" value={String(s.debts)} />
            {s.totals.map((t) => (
              <Row key={t.currency} label="Total owed" value={money(t.minor, t.currency)} />
            ))}
          </View>
          <Note>
            {s.replaced === 0
              ? 'This phone has no data yet. Nothing will be lost.'
              : `This phone has ${s.replaced} ${s.replaced === 1 ? 'debt' : 'debts'} now. They will be deleted and replaced by this backup.`}
          </Note>
          <Text style={styles.small}>
            Your PIN and lock settings stay as they are on this phone. This is a one-time transfer. Your devices will not stay in
            sync.
          </Text>
        </>
      ) : null}

      {step === 'done' ? <Text style={styles.title}>Your data is here. {APP_NAME} is ready.</Text> : null}

      {message ? (
        <Text style={styles.warn} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </BackScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// ponytail: stand-in until slice 5's formatMoney (src/domain/format.ts) is merged; swap it in then.
function money(minor: number, currency: string): string {
  const f = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  return f.format(minor / 10 ** (f.resolvedOptions().maximumFractionDigits ?? 2));
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  head: { gap: space.sm },
  title: { ...type.sectionTitle, color: colors.ink },
  body: { ...type.body, color: colors.muted },
  caption: { ...type.caption, color: colors.muted },
  small: { ...type.small, color: colors.muted },
  warn: { ...type.small, color: colors.accentText },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: space.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowLabel: { ...type.bodySm, color: colors.muted },
  rowValue: { ...type.rowTitleSm, color: colors.ink },
});
