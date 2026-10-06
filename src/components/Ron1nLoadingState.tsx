import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Ron1nColors, Ron1nSpacing, Ron1nTypography } from '../theme/ron1nTheme';

type Props = {
  message?: string;
};

/** One loading shape for the whole app, replacing ad hoc per-screen spinners. */
export default function Ron1nLoadingState({ message = 'Loading…' }: Props) {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="small" color={Ron1nColors.neonPurple} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Ron1nSpacing.xl,
  },
  message: {
    ...Ron1nTypography.caption,
    color: Ron1nColors.muted,
    marginTop: Ron1nSpacing.sm,
  },
});
