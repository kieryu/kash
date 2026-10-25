import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { APP_NAME } from '@/config/app';
import { STRATEGY_NAMES, type StrategyKey } from '@/domain/compare';
import { getAppDb } from '@/db/client';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import type { Settings } from '@/db/schema';
import { fontFamily, theme } from '@/theme';
import { Button } from '@/ui/Button';
import { OnboardingScreen } from '@/ui/Onboarding';
import { PageDots, StrategyCard } from '@/ui/StrategyCard';

type Id = Settings['strategy'] | 'cost' | 'hybrid';

// MVP: Snowball, Avalanche, My own order (D3). Pro ones open the paywall; they arrive in v1.1 (§12).
const CARDS: { id: Id; name: string; how: string; best: string; pro?: boolean }[] = [
  { id: 'snowball', name: 'Snowball', how: 'Pay the smallest balance first. Each debt you clear rolls its payment into the next.', best: 'Best if quick wins keep you going' },
  { id: 'avalanche', name: 'Avalanche', how: 'Pay the highest interest rate first. You pay the least interest overall.', best: 'Best if saving money matters most' },
  { id: 'custom', name: 'My own order', how: 'Drag your debts into the order you want — for example, a family loan first.', best: 'Best if you have your own reasons' },
  { id: 'cost', name: 'Highest cost', how: 'Pay the debt costing you the most pesos in interest this month.', best: 'A practical middle ground', pro: true },
  { id: 'hybrid', name: 'Hybrid', how: 'Clear one or two small debts for momentum, then switch to Avalanche.', best: 'Motivation first, savings after', pro: true },
];

const PAGE = theme.size.strategyCardWidth + 14;

// 04 Choose a strategy. "Help me choose" opens the 04a quiz, which comes back with `recommended`.
export default function Strategy() {
  const { recommended } = useLocalSearchParams<{ recommended?: StrategyKey }>();
  const [picked, setPicked] = useState<Id>('snowball');
  const [page, setPage] = useState(0);
  const carousel = useRef<ScrollViewInstance>(null);
  // Quiz result: select it as soon as it arrives (state adjusted during render, not in an effect).
  const [seen, setSeen] = useState(recommended);
  if (recommended !== seen) {
    setSeen(recommended);
    if (recommended && STRATEGY_NAMES[recommended]) setPicked(recommended);
  }
  const card = CARDS.find((c) => c.id === picked)!;

  useEffect(() => {
    getAppDb().then((db) => {
      if (!recommended) setPicked(getSettings(db).strategy);
    });
    // Only on first load; a quiz result arrives later through `recommended`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const i = CARDS.findIndex((c) => c.id === recommended);
    if (!recommended || i < 0) return;
    carousel.current?.scrollTo({ x: i * PAGE, animated: true });
    AccessibilityInfo.announceForAccessibility(`Recommended: ${STRATEGY_NAMES[recommended]}`);
  }, [recommended]);

  const use = async () => {
    if (card.pro) return;
    updateSettings(await getAppDb(), { strategy: card.id as Settings['strategy'] });
    router.push('/debts');
  };

  return (
    <OnboardingScreen
      step={3}
      fullBleed
      title="How do you want to pay it off?"
      body="Swipe to compare, tap to choose. You can switch anytime."
      footer={
        <>
          {card.pro ? <Text style={styles.note}>{card.name} comes with {APP_NAME} Pro in a later update. Snowball, Avalanche and My own order are free.</Text> : null}
          {card.pro ? (
            <Button variant="secondary" label={`See ${APP_NAME} Pro`} onPress={() => router.push('/pro')} />
          ) : (
            <Button label={`Use ${card.name}`} onPress={use} />
          )}
          <Button variant="link" label="Have a backup? Restore it" onPress={() => router.push('/backup/import')} />
        </>
      }
    >
      <ScrollView
        ref={carousel}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={PAGE}
        decelerationRate="fast"
        contentContainerStyle={styles.carousel}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / PAGE))}
        scrollEventThrottle={64}
      >
        {CARDS.map((c) => (
          <StrategyCard
            key={c.id}
            name={c.name}
            how={c.how}
            best={c.best}
            pro={c.pro}
            selected={c.id === picked}
            recommended={c.id === recommended}
            art={<Art id={c.id} />}
            onPress={() => setPicked(c.id)}
          />
        ))}
      </ScrollView>
      <PageDots count={CARDS.length} index={page} />
      <View style={styles.help}>
        <Button variant="link" label="Not sure? Help me choose" onPress={() => router.push('/quiz')} />
      </View>
    </OnboardingScreen>
  );
}

// Illustrations from design/mockups/Strategy.dc.html.
function Art({ id }: { id: Id }) {
  const g = colors.primary;
  const a = colors.accentLabel;
  const w = colors.surface;
  const label = { fontFamily: fontFamily.bold, fill: g };
  return (
    <Svg width={190} height={96} viewBox="0 0 190 96">
      {id === 'snowball' && (
        <>
          <Path d="M8 84 H182" stroke={colors.lineStrong} strokeWidth={2} />
          <Circle cx={30} cy={76} r={8} fill={w} stroke={g} strokeWidth={3} />
          <Circle cx={78} cy={68} r={16} fill={w} stroke={g} strokeWidth={3} />
          <Circle cx={146} cy={52} r={32} fill={w} stroke={g} strokeWidth={3} />
          <Path d="M44 62 l12 -4 M100 46 l12 -6" stroke={g} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      {id === 'avalanche' && (
        <>
          <Path d="M10 10 L70 40 L120 62 L180 88 L10 88 Z" fill={w} stroke={g} strokeWidth={3} strokeLinejoin="round" />
          <SvgText x={26} y={34} fontSize={16} {...label}>36%</SvgText>
          <SvgText x={80} y={76} fontSize={13} {...label}>24%</SvgText>
          <SvgText x={138} y={84} fontSize={11} {...label}>0%</SvgText>
        </>
      )}
      {id === 'custom' && (
        <>
          <Rect x={30} y={8} width={130} height={22} rx={8} fill={w} stroke={g} strokeWidth={2.5} />
          <Rect x={44} y={37} width={130} height={22} rx={8} fill={w} stroke={g} strokeWidth={2.5} />
          <Rect x={30} y={66} width={130} height={22} rx={8} fill={w} stroke={g} strokeWidth={2.5} />
          <Path d="M42 16 h10 M42 22 h10 M56 45 h10 M56 51 h10 M42 74 h10 M42 80 h10" stroke={g} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
      {id === 'cost' && (
        <>
          <Circle cx={60} cy={56} r={30} fill={w} stroke={a} strokeWidth={3} />
          <SvgText x={60} y={64} textAnchor="middle" fontSize={22} fontFamily={fontFamily.bold} fill={a}>₱</SvgText>
          <Path d="M110 70 L130 44 L148 58 L176 22" fill="none" stroke={a} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {id === 'hybrid' && (
        <>
          <Circle cx={34} cy={70} r={10} fill={w} stroke={a} strokeWidth={3} />
          <Circle cx={70} cy={62} r={18} fill={w} stroke={a} strokeWidth={3} />
          <Path d="M104 22 L140 50 L182 84 L104 84 Z" fill={w} stroke={a} strokeWidth={3} strokeLinejoin="round" />
        </>
      )}
    </Svg>
  );
}

const { colors, space, type } = theme;

const styles = StyleSheet.create({
  carousel: { gap: 14, paddingHorizontal: space.screenOnboarding, paddingVertical: space.xs },
  help: { paddingHorizontal: space.screenOnboarding, alignItems: 'flex-start' },
  note: { ...type.small, color: colors.muted, textAlign: 'center' },
});
