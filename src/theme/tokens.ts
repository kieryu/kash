// Design tokens from design/DESIGN.md §1. The only place hex colors and sizes may be written.

export const colors = {
  bg: '#F3F5EF',
  surface: '#FFFFFF',
  ink: '#142019',
  inkSoft: '#3A4740',
  muted: '#4E5C54',
  line: '#DDE3DA',
  lineStrong: '#C9D6CD',
  divider: '#ECEFE9',
  primary: '#1E5B47',
  primarySoft: '#E2EEE7',
  onPrimarySoft: '#1D3A30',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#CFE3D8',
  primaryTrack: '#2F7660',
  primaryRaised: '#276B55',
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
  handle: '#D5DDD3',
  cardChip: '#E9C77B',
  cardChipLine: '#C9A55A',
  dashedLine: '#8FB09F',
  surfaceSoft: '#F8FAF6',
} as const;

// Sheet backdrop and card shadow: `ink` at these opacities.
export const opacity = { scrim: 0.45, shadow: 0.18 } as const;

export type ColorToken = keyof typeof colors;

// Card colors shown in the debt form's swatch row.
export const cardSwatches = ['#1C3D73', '#1E5B47', '#8E1B2C', '#B24E1A', '#5B3A8C', '#2B2B2B'] as const;

export const mascotColors = {
  fur: '#F0C391',
  face: '#FBE6C8',
  collar: '#E85D8A',
  furLine: '#DDA570',
  innerEar: '#D6A086',
  eye: '#1E130B',
  muzzle: '#FFF3E1',
  tongue: '#E8708C',
  mouth: '#5A3A22',
  brow: '#B9824E',
  tag: '#C9CED3',
  coin: '#E9A23B',
  coinLine: '#A8690F',
  coinText: '#6E430A',
  sleepZ: '#8A5A30',
  shine: '#FFFFFF',
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
  sheet: 24,
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
  lockHalo: 200,
  lockButton: 84,
  pinKey: 72,
  pinDot: 14,
  segment: 30,
  sheetHandleWidth: 40,
  sheetHandleHeight: 4,
  colorBar: 8,
  strategyCardWidth: 286,
  strategyArt: 132,
} as const;
