import React from 'react';
import { StyleSheet, Text, View, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FlickerButton from '../components/FlickerButton';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function WalletScreen() {
  return (
    <LinearGradient colors={[Ron1nColors.black, '#1A002A', Ron1nColors.black]} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.brand}>RON1N</Text>
        <Text style={styles.subtitle}>SYNDICATE // QUANTUM CORE</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>VAULT STATUS</Text>
        <Text style={[styles.idText, { color: Ron1nColors.green }]}>SECURE // QUANTUM-READY</Text>
      </View>

      <FlickerButton 
        title="INITIALIZE ASSET" 
        color={Ron1nColors.green} 
        onPress={() => console.log('Initializing...')} 
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingVertical: 80 },
  header: { alignItems: 'center', marginBottom: 50 },
  brand: { color: '#FFF', fontSize: 42, fontWeight: '900', letterSpacing: 10, textShadowColor: Ron1nColors.purple, textShadowRadius: 20 },
  subtitle: { color: Ron1nColors.green, fontSize: 10, letterSpacing: 4, marginTop: 5 },
  card: { width: '85%', backgroundColor: Ron1nColors.black2, borderRadius: 20, padding: 30, borderWidth: 1.5, borderColor: Ron1nColors.purple, alignItems: 'center' },
  label: { color: '#FFF', fontSize: 8, letterSpacing: 2, marginBottom: 10, opacity: 0.6 },
  idText: { fontSize: 16, fontWeight: '700', letterSpacing: 2 }
});