import React, { useState } from 'react';
import { StyleSheet, Text, View, StatusBar, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';

// Component imports - verified paths
import FlickerButton from '../components/FlickerButton';
import { Ron1nColors, Ron1nGradients } from '../theme/ron1nTheme';

// Service imports - verified paths
import { ActivityService } from './services/transactions/ActivityService';
import { PrivateActivityService } from '../services/PrivateActivityService';

export default function WalletScreen() {
  const [isPrivate, setIsPrivate] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return Alert.alert('Error', 'Biometric support not available.');

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to Sync Activity',
      fallbackLabel: 'Enter Passcode',
    });

    if (result.success) {
      setIsSyncing(true);
      try {
        const newActivities = await ActivityService.fetchChainActivity();
        await PrivateActivityService.saveActivity(newActivities);
        Alert.alert('Sync Complete', 'Local activity ledger updated.');
      } catch (error) {
        Alert.alert('Sync Error', 'Failed to update ledger.');
      } finally {
        setIsSyncing(false);
      }
    }
  };

  return (
    <LinearGradient colors={Ron1nGradients.app} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.brand}>RON1N</Text>
        <Text style={styles.subtitle}>SYNDICATE // QUANTUM CORE</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>VAULT STATUS</Text>
        <Text style={[styles.idText, { color: isPrivate ? Ron1nColors.muted : Ron1nColors.green }]}>
          {isPrivate ? 'PRIVATE // SYNC DISABLED' : 'SECURE // QUANTUM-READY'}
        </Text>
      </View>

      <TouchableOpacity onPress={() => setIsPrivate(!isPrivate)} style={styles.toggle}>
        <Text style={styles.toggleText}>{isPrivate ? 'ENABLE MANUAL SYNC' : 'ENTER PRIVATE MODE'}</Text>
      </TouchableOpacity>

      <FlickerButton 
        title={isSyncing ? "SYNCING..." : (isPrivate ? "LOCKED // AUTH REQUIRED" : "MANUAL SYNC")} 
        color={isPrivate ? Ron1nColors.muted : Ron1nColors.green} 
        onPress={!isPrivate && !isSyncing ? handleManualSync : () => {
           if(isPrivate) Alert.alert('Privacy Mode', 'Disable Privacy Mode to enable sync.');
        }} 
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingVertical: 80 },
  header: { alignItems: 'center', marginBottom: 50 },
  brand: { color: '#FFF', fontSize: 42, fontWeight: '900', letterSpacing: 10, textShadowColor: Ron1nColors.purple, textShadowRadius: 20 },
  subtitle: { color: Ron1nColors.green, fontSize: 10, letterSpacing: 4, marginTop: 5 },
  card: { width: '85%', backgroundColor: Ron1nColors.black2, borderRadius: 20, padding: 30, borderWidth: 1.5, borderColor: Ron1nColors.purple, alignItems: 'center', shadowColor: Ron1nColors.purple, shadowRadius: 20 },
  label: { color: '#FFF', fontSize: 8, letterSpacing: 2, marginBottom: 10, opacity: 0.6 },
  idText: { fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  toggle: { marginVertical: 20 },
  toggleText: { color: Ron1nColors.purple, fontSize: 10, fontWeight: '900', letterSpacing: 2 }
});