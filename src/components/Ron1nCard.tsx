import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function Ron1nCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="summary"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0A0A0D',
    borderColor: 'rgba(140,0,255,0.38)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: Ron1nColors.purple,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
});

