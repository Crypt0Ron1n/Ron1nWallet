import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Ron1nColors } from '../theme/ron1nTheme';

type Accent = 'gold' | 'green' | 'purple' | 'blue';

type Props = {
  title: string;
  subtitle?: string;
  accent?: Accent;
  /** Right-aligned slot (icon buttons, toggles) for screens that need quick actions. */
  rightActions?: React.ReactNode;
};

const ACCENT_COLORS: Record<Accent, string> = {
  gold: Ron1nColors.gold,
  green: Ron1nColors.green,
  purple: Ron1nColors.purple,
  blue: Ron1nColors.blue,
};

/**
 * Shared header used at the top of every screen so title/subtitle scale,
 * spacing, and logo size stay identical app-wide instead of each screen
 * rolling its own hero block.
 */
export default function Ron1nScreenHeader({
  title,
  subtitle,
  accent = 'gold',
  rightActions,
}: Props) {
  const accentColor = ACCENT_COLORS[accent];

  return (
    <View style={styles.row}>
      <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />

      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {rightActions ? <View style={styles.actions}>{rightActions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    resizeMode: 'contain',
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  subtitle: {
    color: Ron1nColors.gray,
    fontSize: 9,
    letterSpacing: 1.8,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});
