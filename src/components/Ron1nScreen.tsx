import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Ron1nColors, Ron1nGradients } from '../theme/ron1nTheme';

/**
 * Shared screen backdrop. Uses the app's own existing gradient token
 * (previously defined but unused) for a deep-obsidian-to-void depth instead
 * of a flat black fill - a static gradient, not a blur, so it costs nothing
 * on scroll and renders identically on every platform.
 */
export default function Ron1nScreen({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Ron1nGradients.app}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
        decelerationRate="fast"
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Ron1nColors.black,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
});
