import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ron1nColors, Ron1nGlass, Ron1nRadii, Ron1nSpacing, ron1nGlow } from '../theme/ron1nTheme';

export type Ron1nCardVariant = 'glass' | 'elevated';
export type Ron1nCardGlow = 'purple' | 'green' | 'cyan' | 'amber' | 'danger' | 'none';

type Props = {
  children: React.ReactNode;
  /** 'glass' (default) is the restrained everyday surface. 'elevated' is a
   * slightly brighter surface for a card that should read as more
   * important on its screen (e.g. a hero balance), still never a glow. */
  variant?: Ron1nCardVariant;
  /** Edge illumination - omit for the default, non-glowing card. Reserve
   * for the handful of elements the brand brief actually calls out
   * (verified security state, selected/primary surface), never every card. */
  glow?: Ron1nCardGlow;
};

const GLOW_COLOR: Record<Exclude<Ron1nCardGlow, 'none'>, string> = {
  purple: Ron1nColors.neonPurple,
  green: Ron1nColors.green,
  cyan: Ron1nColors.cyan,
  amber: Ron1nColors.amber,
  danger: Ron1nColors.danger,
};

export default function Ron1nCard({ children, variant = 'glass', glow = 'none' }: Props) {
  const glowStyle = glow !== 'none' ? ron1nGlow(GLOW_COLOR[glow], 'sm') : null;

  return (
    <View
      style={[
        styles.card,
        variant === 'elevated' ? styles.elevated : styles.glass,
        glowStyle,
        glowStyle ? { borderColor: `${GLOW_COLOR[glow as Exclude<Ron1nCardGlow, 'none'>]}55` } : null,
      ]}
      accessible
      accessibilityRole="summary"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Ron1nRadii.lg,
    padding: Ron1nSpacing.lg + 2,
    marginBottom: Ron1nSpacing.lg,
  },
  glass: {
    backgroundColor: Ron1nGlass.surface,
    borderColor: Ron1nGlass.border,
  },
  elevated: {
    backgroundColor: Ron1nGlass.surfaceElevated,
    borderColor: Ron1nGlass.borderStrong,
  },
});
