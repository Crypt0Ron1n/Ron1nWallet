import { Platform } from 'react-native';

export const Ron1nColors = {
  black: '#050505',
  black2: '#0A0A0A',
  void: '#020204',
  surface: '#0B0B10',
  surfaceElevated: '#111118',
  card: 'rgba(255,255,255,0.045)',
  border: 'rgba(255,255,255,0.12)',

  // Ron1n primary purple hierarchy
  deepPurple: '#240046',
  purple: '#8C00FF',
  neonPurple: '#B026FF',
  purpleHighlight: '#D18CFF',
  purpleSoft: '#6A1BB1',

  // Ron1n security / approved green hierarchy
  deepGreen: '#003B1F',
  green: '#00FF41',
  neonGreen: '#39FF88',
  greenHighlight: '#7CFFB2',
  greenSoft: '#00A83B',

  // Supporting semantic accents
  blue: '#00D4FF',
  cyan: '#22F2FF',
  gold: '#FFD700',
  amber: '#FFB000',
  orange: '#FF8A00',
  red: '#FF3366',
  danger: '#FF4D4D',

  // Accessible neutral hierarchy
  white: '#FFFFFF',
  gray: '#B8B8C2',
  muted: '#777783',
  disabled: '#5B5B66',
  focus: '#FFFFFF',
};

export const Ron1nGradients = {
  app: ['#050505', '#240046', '#02040A'] as const,
  vault: ['#050505', '#0B1020', '#003B1F'] as const,
  purple: ['#240046', '#8C00FF', '#B026FF'] as const,
  green: ['#003B1F', '#00A83B', '#00FF41'] as const,
};

export const Ron1nSemanticColors = {
  primaryAction: Ron1nColors.neonPurple,
  primaryActionBackground: Ron1nColors.deepPurple,
  securityApproved: Ron1nColors.neonGreen,
  securityBackground: Ron1nColors.deepGreen,
  focusRing: Ron1nColors.focus,
  warning: Ron1nColors.amber,
  danger: Ron1nColors.danger,
  information: Ron1nColors.cyan,
  attention: Ron1nColors.gold,
} as const;

/**
 * Phase 3 design-system foundation. One spacing/typography/status scale for
 * the whole app, replacing ad hoc per-screen values. Deliberately does not
 * reference 'KatakanaStyle' - that font name is never loaded anywhere in the
 * project (no app.json font config, no useFonts/Font.loadAsync call), so
 * every existing usage was already silently falling back to the platform
 * default. These tokens make that explicit instead of perpetuating a dead
 * font reference.
 */
export const Ron1nSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Ron1nRadii = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

export const Ron1nButtonHeight = 52;
export const Ron1nRowHeight = 60;
export const Ron1nScreenPadding = Ron1nSpacing.lg;

type TextStyleToken = {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700' | '800' | '900';
  letterSpacing: number;
  lineHeight: number;
  textTransform?: 'uppercase';
};

/**
 * RON1N DISPLAY / SCREEN TITLE / SECTION TITLE / CARD TITLE / LABEL / BODY /
 * BODY SECONDARY / CAPTION / TECHNICAL - the full hierarchy from the brand
 * spec. Controlled letter-spacing (uppercase labels only), no monospace
 * outside TECHNICAL, no oversized tracking anywhere.
 */
export const Ron1nTypography: Record<string, TextStyleToken> = {
  display: { fontSize: 34, fontWeight: '900', letterSpacing: 0.3, lineHeight: 38 },
  screenTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 0.6, lineHeight: 25 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    lineHeight: 17,
    textTransform: 'uppercase',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2, lineHeight: 20 },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
  body: { fontSize: 14, fontWeight: '500', letterSpacing: 0.1, lineHeight: 20 },
  bodySecondary: { fontSize: 13, fontWeight: '500', letterSpacing: 0.1, lineHeight: 19 },
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, lineHeight: 15 },
};

/** TECHNICAL / MONOSPACE - addresses, hashes, nonces, network identifiers only. */
export const Ron1nMonospace = {
  fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  fontSize: 12,
  letterSpacing: 0,
} as const;

export type Ron1nStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

/**
 * One status vocabulary for the whole app (ActivityScreen's lifecycle
 * states, Security's exposure levels, Privacy's availability states, etc.).
 * Color is never the only signal - every consumer must pair this with a
 * label and/or icon, never color alone.
 */
export const Ron1nStatusTokens: Record<
  Ron1nStatusTone,
  { color: string; background: string; border: string; icon: string }
> = {
  success: {
    color: Ron1nColors.green,
    background: `${Ron1nColors.green}14`,
    border: `${Ron1nColors.green}44`,
    icon: 'checkmark-circle',
  },
  warning: {
    color: Ron1nColors.amber,
    background: `${Ron1nColors.amber}14`,
    border: `${Ron1nColors.amber}44`,
    icon: 'alert-circle',
  },
  danger: {
    color: Ron1nColors.danger,
    background: `${Ron1nColors.danger}14`,
    border: `${Ron1nColors.danger}44`,
    icon: 'close-circle',
  },
  info: {
    color: Ron1nColors.cyan,
    background: `${Ron1nColors.cyan}14`,
    border: `${Ron1nColors.cyan}44`,
    icon: 'information-circle',
  },
  primary: {
    color: Ron1nColors.neonPurple,
    background: `${Ron1nColors.neonPurple}14`,
    border: `${Ron1nColors.neonPurple}44`,
    icon: 'ellipse',
  },
  neutral: {
    color: Ron1nColors.gray,
    background: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.12)',
    icon: 'help-circle',
  },
};
