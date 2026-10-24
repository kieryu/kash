import Svg, { Path } from 'react-native-svg';

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
