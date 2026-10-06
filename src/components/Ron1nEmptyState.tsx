import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Ron1nColors, Ron1nSpacing, Ron1nTypography } from '../theme/ron1nTheme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
};

/**
 * One empty-state shape for the whole app. Never shows a placeholder number
 * or fake balance - just an honest title + explanation of what will appear
 * and when.
 */
export default function Ron1nEmptyState({ icon, title, message }: Props) {
  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={`${title}. ${message}`}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={Ron1nColors.muted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Ron1nSpacing.xl,
    paddingHorizontal: Ron1nSpacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: Ron1nSpacing.md,
  },
  title: {
    ...Ron1nTypography.label,
    color: Ron1nColors.gray,
    marginBottom: Ron1nSpacing.xs,
    textAlign: 'center',
  },
  message: {
    ...Ron1nTypography.bodySecondary,
    color: Ron1nColors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
