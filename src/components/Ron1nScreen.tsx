import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ron1nGradients } from '../theme/ron1nTheme';

export default function Ron1nScreen({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={Ron1nGradients.app} style={styles.container}>
      <View style={styles.purpleGlow} />
      <View style={styles.greenGlow} />
      <View style={styles.blueGlow} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {children}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  purpleGlow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 220,
    backgroundColor: '#B026FF',
    opacity: 0.16,
    top: 30,
    right: -140,
  },
  greenGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 200,
    backgroundColor: '#00FF41',
    opacity: 0.08,
    top: 260,
    left: -120,
  },
  blueGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 200,
    backgroundColor: '#00D4FF',
    opacity: 0.07,
    bottom: 90,
    right: -110,
  },
});