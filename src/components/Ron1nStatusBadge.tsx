import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Ron1nRadii, Ron1nSpacing, Ron1nStatusTokens, type Ron1nStatusTone } from '../theme/ron1nTheme';

type Props = {
  tone: Ron1nStatusTone;
  label: string;
  /** Override the tone's default icon when a more specific one applies. */
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * One status pill for the whole app. Never color-only: every badge pairs a
 * tone with a text label and an icon, so status is still legible without
 * relying on color perception alone.
 */
export default function Ron1nStatusBadge({ tone, label, icon }: Props) {
  const token = Ron1nStatusTokens[tone];

  return (
    <View
      style={[styles.badge, { backgroundColor: token.background, borderColor: token.border }]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Ionicons name={(icon ?? token.icon) as keyof typeof Ionicons.glyphMap} size={12} color={token.color} />
      <Text style={[styles.label, { color: token.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Ron1nSpacing.xs,
    borderWidth: 1,
    borderRadius: Ron1nRadii.pill,
    paddingHorizontal: Ron1nSpacing.sm + 2,
    paddingVertical: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
