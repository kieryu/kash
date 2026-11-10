import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { theme } from '@/theme';

type Props = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** Spoken value, e.g. "₱10,000". */
  valueText: string;
  /** Replaces the default green track, e.g. a color gradient. Drawn full width behind the thumb. */
  track?: ReactNode;
  /** Thumb fill (default white), e.g. the picked color. */
  thumbColor?: string;
};

/** Horizontal slider on plain RN touch events (no native module). Snaps to multiples of `step`. */
export function Slider({ value, min, max, step, onChange, accessibilityLabel, valueText, track, thumbColor }: Props) {
  const [width, setWidth] = useState(0);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const ratio = max > min ? (clamp(value) - min) / (max - min) : 0;

  const move = (e: GestureResponderEvent) => {
    if (!width) return;
    const r = Math.min(1, Math.max(0, (e.nativeEvent.locationX - THUMB / 2) / (width - THUMB)));
    onChange(clamp(Math.round((min + r * (max - min)) / step) * step));
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={move}
      onResponderMove={move}
      style={styles.hit}
    >
      {track ? (
        <View pointerEvents="none" style={styles.customTrack}>
          {track}
        </View>
      ) : (
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
      )}
      <View
        pointerEvents="none"
        style={[styles.thumb, thumbColor ? { backgroundColor: thumbColor, borderColor: colors.surface } : null, { left: ratio * Math.max(0, width - THUMB) }]}
      />
    </View>
  );
}

const { colors, radius, size } = theme;
const THUMB = 26;

const styles = StyleSheet.create({
  hit: { height: size.hitTarget, justifyContent: 'center' },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.segmentBg, overflow: 'hidden', marginHorizontal: THUMB / 2 },
  fill: { height: '100%', backgroundColor: colors.primary },
  customTrack: { height: 14, borderRadius: radius.pill, overflow: 'hidden', marginHorizontal: THUMB / 2 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
  },
});
