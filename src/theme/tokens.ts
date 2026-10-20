// Design tokens from design/DESIGN.md §1. The only place hex colors and sizes may be written.

export const colors = {
  bg: '#F3F5EF',
  surface: '#FFFFFF',
  ink: '#142019',
  muted: '#4E5C54',
  line: '#DDE3DA',
  lineStrong: '#C9D6CD',
  divider: '#ECEFE9',
  primary: '#1E5B47',
  primarySoft: '#E2EEE7',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#CFE3D8',
  primaryTrack: '#2F7660',
  accent: '#E9A23B',
  onAccent: '#2E1C04',
  accentSoft: '#FCF3E3',
  accentText: '#5E3D08',
  accentLabel: '#8A5A12',
  proChipBg: '#FCEBCB',
  proChipText: '#6E430A',
  danger: '#A3361C',
  segmentBg: '#E3E9E1',
  switchOff: '#B7C2BB',
} as const;

export type ColorToken = keyof typeof colors;

// Card colors shown in the debt form's swatch row.
export const cardSwatches = ['#1C3D73', '#1E5B47', '#8E1B2C', '#B24E1A', '#5B3A8C', '#2B2B2B'] as const;

export const mascotColors = {
  fur: '#F0C391',
  face: '#FBE6C8',
  collar: '#E85D8A',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screenOnboarding: 24,
  screenApp: 20,
} as const;

export const radius = {
  input: 12,
  inputLg: 14,
  button: 16,
  card: 16,
  cardLg: 22,
  pill: 999,
} as const;

export const size = {
  buttonPrimary: 56,
  buttonSecondary: 52,
  input: 48,
  hitTarget: 44,
  border: 1.5,
  progressBar: 8,
  switchWidth: 52,
  switchHeight: 32,
  debtCardFull: 168,
  debtCardList: 150,
  debtCardMiniWidth: 148,
  debtCardMiniHeight: 92,
} as const;
