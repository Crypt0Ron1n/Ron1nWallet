import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Ron1nPressable from './Ron1nPressable';
import {
  Ron1nButtonHeight,
  Ron1nColors,
  Ron1nGradients,
  Ron1nRadii,
  Ron1nSpacing,
  Ron1nTypography,
  ron1nGlow,
} from '../theme/ron1nTheme';

export type Ron1nButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Ron1nButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  busy?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const VARIANT_STYLE: Record<
  Ron1nButtonVariant,
  { background: string; border: string; text: string }
> = {
  primary: {
    background: Ron1nColors.neonPurple,
    border: Ron1nColors.neonPurple,
    text: Ron1nColors.white,
  },
  secondary: {
    background: Ron1nColors.inputBg,
    border: Ron1nColors.border,
    text: Ron1nColors.white,
  },
  outline: {
    background: 'transparent',
    border: 'rgba(255,255,255,0.22)',
    text: Ron1nColors.white,
  },
  danger: {
    background: `${Ron1nColors.danger}18`,
    border: `${Ron1nColors.danger}66`,
    text: '#FF7777',
  },
  ghost: {
    background: 'transparent',
    border: 'transparent',
    text: Ron1nColors.gray,
  },
};

/**
 * One button system for the whole app. `disabled` is a state layered on any
 * variant - not a separate look to choose - so every variant degrades the
 * same predictable way rather than each screen inventing its own disabled
 * treatment.
 */
export default function Ron1nButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  busy = false,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const tone = VARIANT_STYLE[variant];
  const isInactive = disabled || busy;
  const showGradient = variant === 'primary' && !isInactive;

  return (
    <Ron1nPressable
      onPress={isInactive ? undefined : onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy }}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: isInactive ? Ron1nColors.pressed : tone.background,
          borderColor: isInactive ? Ron1nColors.border : tone.border,
        },
        showGradient && styles.gradientClip,
        // Glow is reserved for the primary call-to-action only - every other
        // variant (secondary/outline/danger/ghost) stays flat on purpose.
        showGradient ? ron1nGlow(Ron1nColors.neonPurple, 'md') : null,
      ]}
    >
      {showGradient ? (
        <LinearGradient
          colors={Ron1nGradients.primaryButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <View style={styles.content}>
        {busy ? (
          <ActivityIndicator size="small" color={tone.text} />
        ) : (
          <>
            {icon ? (
              <Ionicons
                name={icon}
                size={17}
                color={isInactive ? Ron1nColors.disabled : tone.text}
                style={styles.icon}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                { color: isInactive ? Ron1nColors.disabled : tone.text },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Ron1nPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: Ron1nButtonHeight,
    borderRadius: Ron1nRadii.button,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Ron1nSpacing.lg,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  gradientClip: {
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  icon: {
    marginRight: Ron1nSpacing.sm,
  },
  label: {
    ...Ron1nTypography.label,
    fontSize: 12,
    letterSpacing: 1,
  },
});
