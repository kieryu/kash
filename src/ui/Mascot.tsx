import Svg, { Circle, Ellipse, G, Path, Text } from 'react-native-svg';

import { fontFamily, mascotColors as m } from '@/theme';

export type MascotMood = 'watch' | 'cheer' | 'concern' | 'hide' | 'sleep' | 'think';

type Props = { mood?: MascotMood; size?: number };

// Ported from design/mockups/Mascot.dc.html: each mood shows or hides parts of one drawing.
const base = { open: 1, happy: 0, sleep: 0, hide: 0, brow: 0, coin: 1, smile: 1, flat: 0, spark: 0, think: 0, lx: 46, rx: 74, py: 54 };
const moods: Record<MascotMood, Partial<typeof base>> = {
  watch: {},
  cheer: { open: 0, happy: 1, spark: 1 },
  concern: { brow: 1, smile: 0, flat: 1, py: 56 },
  hide: { open: 0, hide: 1, coin: 0 },
  sleep: { open: 0, sleep: 1, coin: 0, smile: 0, flat: 1 },
  think: { lx: 48, rx: 76, py: 51, think: 1, smile: 0, flat: 1 },
};

export const mascotLabels: Record<MascotMood, string> = {
  watch: 'Pomeranian mascot smiling, holding a coin',
  cheer: 'Pomeranian mascot cheering',
  concern: 'Pomeranian mascot looking gently concerned',
  hide: 'Pomeranian mascot covering its eyes — balances hidden',
  sleep: 'Pomeranian mascot sleeping — app locked',
  think: 'Pomeranian mascot thinking',
};

export function Mascot({ mood = 'watch', size = 160 }: Props) {
  const v = { ...base, ...moods[mood] };
  const hy = v.py - 2.5;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessible accessibilityRole="image" accessibilityLabel={mascotLabels[mood]}>
      <Ellipse cx={60} cy={102} rx={34} ry={18} fill={m.fur} />
      <Path d="M32 92 Q36 84 42 90 Q46 82 52 89 Q56 81 60 88 Q64 81 68 89 Q74 82 78 90 Q84 84 88 92 Q60 110 32 92 Z" fill={m.face} />
      <Path d="M29 42 L31 6 Q35 4 38 8 L54 30 Z" fill={m.fur} stroke={m.furLine} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M91 42 L89 6 Q85 4 82 8 L66 30 Z" fill={m.fur} stroke={m.furLine} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M34 35 L34 14 L46 30 Z" fill={m.innerEar} />
      <Path d="M86 35 L86 14 L74 30 Z" fill={m.innerEar} />
      <Circle cx={60} cy={58} r={35} fill={m.fur} />
      <Ellipse cx={60} cy={66} rx={25} ry={21} fill={m.face} />
      {v.open ? (
        <G>
          <Circle cx={v.lx} cy={v.py} r={7} fill={m.eye} />
          <Circle cx={v.rx} cy={v.py} r={7} fill={m.eye} />
          <Circle cx={v.lx + 2.5} cy={hy} r={2.2} fill={m.shine} />
          <Circle cx={v.rx + 2.5} cy={hy} r={2.2} fill={m.shine} />
        </G>
      ) : null}
      {v.happy ? (
        <G fill="none" stroke={m.eye} strokeWidth={3.5} strokeLinecap="round">
          <Path d="M39 56 Q46 47 53 56" />
          <Path d="M67 56 Q74 47 81 56" />
        </G>
      ) : null}
      {v.sleep ? (
        <G fill="none" stroke={m.eye} strokeWidth={3} strokeLinecap="round">
          <Path d="M39 54 Q46 60 53 54" />
          <Path d="M67 54 Q74 60 81 54" />
        </G>
      ) : null}
      {v.brow ? (
        <G fill="none" stroke={m.brow} strokeWidth={3} strokeLinecap="round">
          <Path d="M37 43 L50 47" />
          <Path d="M83 43 L70 47" />
        </G>
      ) : null}
      <Ellipse cx={60} cy={71} rx={12} ry={9} fill={m.muzzle} />
      <Ellipse cx={60} cy={67} rx={5} ry={3.8} fill={m.eye} />
      {v.smile ? (
        <G>
          <Ellipse cx={60} cy={79} rx={4.5} ry={5.5} fill={m.tongue} />
          <Path d="M50 73 Q55 78 60 74 Q65 78 70 73" fill="none" stroke={m.mouth} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      ) : null}
      {v.flat ? <Path d="M54 76 Q60 74 66 76" fill="none" stroke={m.mouth} strokeWidth={2.2} strokeLinecap="round" /> : null}
      <Path d="M36 87 Q60 97 84 87" fill="none" stroke={m.collar} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={60} cy={95} r={2.6} fill={m.tag} />
      {v.coin ? (
        <G>
          <Circle cx={60} cy={104} r={12} fill={m.coin} stroke={m.coinLine} strokeWidth={2} />
          <Text x={60} y={109} textAnchor="middle" fontSize={13} fontFamily={fontFamily.bold} fill={m.coinText}>
            ₱
          </Text>
          <Ellipse cx={47} cy={104} rx={6.5} ry={5.5} fill={m.fur} stroke={m.furLine} strokeWidth={1.5} />
          <Ellipse cx={73} cy={104} rx={6.5} ry={5.5} fill={m.fur} stroke={m.furLine} strokeWidth={1.5} />
        </G>
      ) : null}
      {v.hide ? (
        <G>
          <Ellipse cx={45} cy={54} rx={13} ry={11} fill={m.fur} stroke={m.furLine} strokeWidth={2} />
          <Ellipse cx={75} cy={54} rx={13} ry={11} fill={m.fur} stroke={m.furLine} strokeWidth={2} />
          <Path d="M40 46 L40 52 M45 45 L45 52 M50 46 L50 52" fill="none" stroke={m.furLine} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M70 46 L70 52 M75 45 L75 52 M80 46 L80 52" fill="none" stroke={m.furLine} strokeWidth={1.8} strokeLinecap="round" />
        </G>
      ) : null}
      {v.spark ? (
        <G fill={m.coin}>
          <Path d="M10 70 L13 77 L20 80 L13 83 L10 90 L7 83 L0 80 L7 77 Z" />
          <Path d="M108 70 L110.5 76 L116.5 78.5 L110.5 81 L108 87 L105.5 81 L99.5 78.5 L105.5 76 Z" />
        </G>
      ) : null}
      {v.sleep ? (
        <G fill={m.sleepZ} fontFamily={fontFamily.bold}>
          <Text x={100} y={26} fontSize={14}>
            z
          </Text>
          <Text x={110} y={16} fontSize={10}>
            z
          </Text>
        </G>
      ) : null}
      {v.think ? (
        <G fill={m.furLine}>
          <Circle cx={106} cy={22} r={5} />
          <Circle cx={114} cy={12} r={3} />
        </G>
      ) : null}
    </Svg>
  );
}
