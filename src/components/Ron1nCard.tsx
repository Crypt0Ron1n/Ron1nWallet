import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function Ron1nCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Ron1nColors.card,
    borderColor: Ron1nColors.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowColor: Ron1nColors.purple,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
});