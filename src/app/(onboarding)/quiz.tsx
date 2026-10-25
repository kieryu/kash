import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import { recommend, type Motivation } from '@/domain/quiz';
import { theme } from '@/theme';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';
import { AnswerCard, OnboardingScreen } from '@/ui/Onboarding';

// 04a "Help me choose" (design/proposals/quiz.md): two questions, then back to 04 with the pick.
export default function Quiz() {
  const [q, setQ] = useState<1 | 2>(1);
  const [motivation, setMotivation] = useState<Motivation | null>(null);
  const [ownOrder, setOwnOrder] = useState<boolean | null>(null);

  const done = () => {
    if (!motivation || ownOrder === null) return;
    router.dismissTo({ pathname: '/strategy', params: { recommended: recommend(motivation, ownOrder) } });
  };

  const line = q === 1 ? "Two quick questions, then I'll suggest a match." : 'Last one!';

  return (
    <OnboardingScreen
      step={3}
      onBack={() => (q === 2 ? setQ(1) : router.back())}
      art={
        <View style={styles.mascot}>
          <Mascot mood="think" size={96} />
          <Text style={styles.line}>{line}</Text>
        </View>
      }
      title={q === 1 ? 'What keeps you going?' : 'Is there a debt you want gone first, no matter what?'}
      body={q === 2 ? 'For example, money owed to family.' : undefined}
      footer={
        q === 1 ? (
          <Button label="Next" disabled={!motivation} onPress={() => setQ(2)} />
        ) : (
          <Button label="See my match" disabled={ownOrder === null} onPress={done} />
        )
      }
    >
      <View accessibilityRole="radiogroup" style={styles.answers}>
        {q === 1 ? (
          <>
            <AnswerCard title="Seeing debts disappear fast" caption="Quick wins keep me motivated" selected={motivation === 'wins'} onPress={() => setMotivation('wins')} />
            <AnswerCard title="Knowing I'm saving money" caption="I can stay patient" selected={motivation === 'savings'} onPress={() => setMotivation('savings')} />
          </>
        ) : (
          <>
            <AnswerCard title="Yes, I have my own order" selected={ownOrder === true} onPress={() => setOwnOrder(true)} />
            <AnswerCard title={`No, let ${APP_NAME} decide`} selected={ownOrder === false} onPress={() => setOwnOrder(false)} />
          </>
        )}
      </View>
    </OnboardingScreen>
  );
}

const { colors, space, type } = theme;

const styles = StyleSheet.create({
  mascot: { alignItems: 'center', gap: space.sm },
  line: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  answers: { gap: space.md },
});
