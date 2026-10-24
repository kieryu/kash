import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { exportBackup, MIN_PASSWORD_LENGTH } from '@/backup/backup';
import { backupFileName, formatBackupDate } from '@/backup/preview';
import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { theme } from '@/theme';
import { BackScreen, Note, PasswordField } from '@/ui/Backup';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';

// Export an encrypted backup via the share sheet (CLAUDE.md §9, design/proposals/backup-export.md).
export default function ExportBackup() {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  // Encrypted file contents, kept for "Share again".
  const file = useRef<string | null>(null);

  useEffect(() => {
    getAppDb().then((db) => setLastBackupAt(getSettings(db).lastBackupAt));
  }, []);

  const mismatch = again.length > 0 && again !== password;
  const ready = password.length >= MIN_PASSWORD_LENGTH && again === password;

  const share = async () => {
    setBusy(true);
    setError(false);
    const tmp = new File(Paths.cache, backupFileName());
    try {
      const db = await getAppDb();
      const content = file.current ?? (await exportBackup(db, password));
      await tmp.write(content);
      await Sharing.shareAsync(tmp.uri, { mimeType: 'application/json', dialogTitle: 'Save your backup' });
      // Android can’t tell a save from a closed sheet; count it once the sheet closes without error.
      const now = new Date().toISOString();
      updateSettings(db, { lastBackupAt: now });
      file.current = content;
      setLastBackupAt(now);
      setDone(true);
      setPassword('');
      setAgain('');
    } catch {
      setError(true);
    } finally {
      if (tmp.exists) tmp.delete();
      setBusy(false);
    }
  };

  const back = () => {
    if (!busy) router.back();
  };

  return (
    <BackScreen
      title="Export backup"
      onBack={back}
      footer={
        <>
          {done ? (
            <>
              <Button label="Done" onPress={back} />
              <Button variant="secondary" label="Share again" onPress={share} disabled={busy} />
            </>
          ) : (
            <Button label={busy ? 'Locking your file…' : 'Create backup file'} onPress={share} disabled={!ready || busy} />
          )}
          <Text style={[styles.caption, styles.centered]}>Last backup: {lastBackupAt ? formatBackupDate(lastBackupAt) : 'never'}</Text>
        </>
      }
    >
      <View style={styles.center}>
        <Mascot mood={done ? 'cheer' : busy ? 'think' : 'watch'} size={96} />
      </View>
      {done ? (
        <Text style={styles.title} accessibilityLiveRegion="polite">
          Backup saved. Keep the file and your password somewhere safe.
        </Text>
      ) : (
        <>
          <View style={styles.head}>
            <Text style={styles.title}>Save a copy of your data</Text>
            <Text style={styles.body}>One file with all your debts, payments and settings, locked with a password you choose.</Text>
          </View>
          <View style={styles.head}>
            <PasswordField label="Backup password" value={password} onChangeText={setPassword} editable={!busy} />
            <Text style={styles.caption}>At least {MIN_PASSWORD_LENGTH} characters</Text>
          </View>
          <View style={styles.head}>
            <PasswordField label="Type it again" value={again} onChangeText={setAgain} editable={!busy} />
            {mismatch ? <Text style={styles.warn}>The passwords don’t match.</Text> : null}
          </View>
          <Note>
            Write this password down. Without it, nobody can open the file — not even {APP_NAME}. There’s no way to reset it.
          </Note>
        </>
      )}
      {error ? <Note>Couldn’t create the file. Nothing was changed. Try again.</Note> : null}
      <Text style={styles.small}>This is a one-time transfer. Your devices will not stay in sync.</Text>
      <Text style={styles.small}>Your PIN and lock settings stay on this phone. Pro is restored from Google Play.</Text>
    </BackScreen>
  );
}

const { colors, space, type } = theme;

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  head: { gap: space.sm },
  title: { ...type.sectionTitle, color: colors.ink },
  body: { ...type.body, color: colors.muted },
  caption: { ...type.caption, color: colors.muted },
  centered: { textAlign: 'center' },
  warn: { ...type.small, color: colors.accentText },
  small: { ...type.small, color: colors.muted },
});
