import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { size: number; color: string };

// Paths from design/mockups (24×24 stroke icons).

export function FingerprintIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 11c0 3.5-1 6.5-2.5 9" />
      <Path d="M14.5 13c0 2.5-.5 5-1.5 7.5" />
      <Path d="M17.5 18c.3-1.5.5-3.5.5-5.5a6 6 0 0 0-10.5-4" />
      <Path d="M6 11.5c0 2-.3 3.5-1 5" />
      <Path d="M9 11a3 3 0 0 1 6 0" />
      <Path d="M3.5 8.5A9.5 9.5 0 0 1 20 7" />
    </Svg>
  );
}

export function BackIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function DeleteIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 5h11v14H9l-6-7z" />
      <Path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
    </Svg>
  );
}

export function CheckIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5l4.5 4L19 7" />
    </Svg>
  );
}

export function TargetIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4}>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={4} />
    </Svg>
  );
}

/** Filled circle with a check: selected strategy card. */
export function CheckBadge({ size, color, checkColor }: IconProps & { checkColor: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill={color} />
      <Path d="M7 12.5l3.2 3L17 9" fill="none" stroke={checkColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Stroke({ size, color, children }: IconProps & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export const EyeIcon = (p: IconProps) => (
  <Stroke {...p}>
    <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <Circle cx={12} cy={12} r={3} />
  </Stroke>
);

export const PlusIcon = (p: IconProps) => (
  <Stroke {...p}>
    <Path d="M12 5v14M5 12h14" />
  </Stroke>
);

export const CloseIcon = (p: IconProps) => (
  <Stroke {...p}>
    <Path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
);

// Tab bar
export const HomeIcon = (p: IconProps) => (
  <Stroke {...p}>
    <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </Stroke>
);

export const PlanIcon = (p: IconProps) => (
  <Stroke {...p}>
    <Path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" />
  </Stroke>
);

export const CardIcon = (p: IconProps) => (
  <Stroke {...p}>
    <Rect x={3} y={6} width={18} height={13} rx={2} />
    <Path d="M3 10h18" />
  </Stroke>
);

export const SettingsIcon = (p: IconProps) => (
  <Stroke {...p}>
    <Circle cx={12} cy={12} r={3} />
    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </Stroke>
);

export const ChevronIcon = (p: IconProps) => (
  <Stroke {...p}>
    <Path d="M9 5l7 7-7 7" />
  </Stroke>
);
