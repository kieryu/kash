import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { MIN_LIGHTNESS, PICKER_SATURATION, hslToHex, maxLightness, pickerColor, pickerStart } from '@/domain/color';
import { theme } from '@/theme';

import { Slider } from './Slider';

type Props = {
  /** Current card color, "#RRGGBB". The sliders start where it sits. */
  value: string;
  onChange: (hex: string) => void;
};

const HUE_NAMES: [number, string][] = [
  [15, 'red'],
  [45, 'orange'],
  [70, 'yellow'],
  [160, 'green'],
  [200, 'teal'],
  [250, 'blue'],
  [290, 'purple'],
  [335, 'pink'],
  [360, 'red'],
];
const hueName = (h: number) => HUE_NAMES.find(([upTo]) => h < upTo)![1];

/** Custom card color: a hue bar and a shade bar. Every color it can make keeps white card text readable. */
export function ColorPicker({ value, onChange }: Props) {
  // Positions are kept here (not re-derived from `value`) so the thumbs don't jump from rounding.
  const [pos, setPos] = useState(() => pickerStart(value));
  const update = (next: { hue: number; shade: number }) => {
    setPos(next);
    onChange(pickerColor(next.hue, next.shade));
  };
  const top = maxLightness(pos.hue);

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Color</Text>
      <Slider
        accessibilityLabel="Card color"
        valueText={hueName(pos.hue)}
        value={pos.hue}
        min={0}
        max={359}
        step={1}
        onChange={(hue) => update({ ...pos, hue })}
        thumbColor={pickerColor(pos.hue, 30)}
        track={<Gradient id="hue" stops={Array.from({ length: 13 }, (_, i) => hslToHex(i * 30, PICKER_SATURATION + 10, 45))} />}
      />
      <Text style={styles.label}>Shade</Text>
      <Slider
        accessibilityLabel="Card shade"
        valueText={pos.shade < 34 ? 'lighter' : pos.shade < 67 ? 'medium' : 'darker'}
        value={pos.shade}
        min={0}
        max={100}
        step={1}
        onChange={(shade) => update({ ...pos, shade })}
        thumbColor={pickerColor(pos.hue, pos.shade)}
        track={<Gradient id="shade" stops={[hslToHex(pos.hue, PICKER_SATURATION, top), hslToHex(pos.hue, PICKER_SATURATION, MIN_LIGHTNESS)]} />}
      />
    </View>
  );
}

function Gradient({ id, stops }: { id: string; stops: string[] }) {
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {stops.map((c, i) => (
            <Stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const { colors, radius, space, type } = theme;

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.xs },
  label: { ...type.label, color: colors.muted },
});
