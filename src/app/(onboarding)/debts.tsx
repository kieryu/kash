import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { APP_NAME } from '@/config/app';
import { getAppDb } from '@/db/client';
import { listDebts } from '@/db/repositories/debts';
import { getEntitlement } from '@/db/repositories/settings';
import { balances } from '@/db/repositories/transactions';
import type { DebtRow } from '@/db/schema';
import { KIND_LABELS, templateById } from '@/domain/debtForm';
import { formatMoney } from '@/domain/format';
import { canAddDebt, FREE_DEBT_LIMIT } from '@/domain/plan';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { DebtCard } from '@/ui/DebtCard';
import { Mascot } from '@/ui/Mascot';
import { OnboardingScreen } from '@/ui/Onboarding';

// 05 Add your debts.
export default function Debts() {
  const [data, setData] = useState<{ rows: DebtRow[]; balances: Map<string, number>; canAdd: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      getAppDb().then((db) => {
        const rows = listDebts(db);
        setData({ rows, balances: balances(db), canAdd: canAddDebt(rows.length, getEntitlement(db).isPro) });
      });
    }, []),
  );

  const count = data?.rows.length ?? 0;

  return (
    <OnboardingScreen
      step={4}
      title="Add your debts"
      body="Cards, installments, loans — even money owed to family. The plan works best when everything is in it."
      footer={
        <Button
          label={`Continue · ${count} ${count === 1 ? 'debt' : 'debts'} added`}
          disabled={count === 0}
          onPress={() => router.push('/budget')}
        />
      }
    >
      {data?.rows.map((d) => (
        <DebtCard
          key={d.id}
          variant="list"
          color={d.color}
          nickname={d.nickname}
          balanceText={formatMoney(data.balances.get(d.id) ?? 0, d.currency)}
          issuer={d.issuer ?? KIND_LABELS[d.kind]}
          kindLabel={KIND_LABELS[d.kind]}
          network={templateById(d.templateId)?.network}
        />
      ))}

      {data && data.canAdd ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/debt-form')}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <View style={styles.plus}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </View>
          <Text style={styles.addTitle}>Add a card or loan</Text>
          <Text style={styles.addSub}>Credit card · Installment · SSS / Pag-IBIG · Family</Text>
        </Pressable>
      ) : null}
      {data && !data.canAdd ? (
        <Text style={styles.limit}>
          The free plan holds {FREE_DEBT_LIMIT} debts. {APP_NAME} Pro adds more — you can keep going with these for now.{' '}
          <Text accessibilityRole="link" style={styles.limitLink} onPress={() => router.push('/pro')}>
            See {APP_NAME} Pro
          </Text>
        </Text>
      ) : null}

      <View style={styles.tip}>
        <Mascot mood="think" size={64} />
        <Text style={styles.tipText}>No need for exact numbers yet. You can update balances anytime.</Text>
      </View>
    </OnboardingScreen>
  );
}

const { colors, radius, size, space, type } = theme;

const styles = StyleSheet.create({
  add: {
    height: size.debtCardList,
    borderRadius: radius.cardLg - 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.dashedLine,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pressed: { opacity: 0.85 },
  plus: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  addTitle: { ...type.button, color: colors.primary },
  addSub: { ...type.small, color: colors.muted },
  limit: { ...type.small, color: colors.accentText, backgroundColor: colors.accentSoft, borderRadius: radius.inputLg, padding: space.md, overflow: 'hidden' },
  limitLink: { ...type.label, color: colors.accentText, textDecorationLine: 'underline' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: space.md, paddingHorizontal: 14 },
  tipText: { ...type.bodySm, color: colors.inkSoft, flex: 1 },
});
