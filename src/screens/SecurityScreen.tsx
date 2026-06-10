import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import { ActivityService, Ron1nActivity } from '../services/ActivityService';

export default function SecurityScreen() {
  const [activities, setActivities] = useState<Ron1nActivity[]>([]);

  const loadActivities = async () => {
    const data = await ActivityService.getActivities();
    setActivities(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [])
  );

  const clearHistory = async () => {
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Clear Ron1n Activity',
      fallbackLabel: 'Use device passcode',
    });

    if (!auth.success) return;

    await ActivityService.clearActivities();
    await loadActivities();
    Alert.alert('Cleared', 'Private activity history cleared.');
  };

  return (
    <LinearGradient colors={['#050505', '#0A0014', '#050505']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>SECURITY CENTER</Text>
          <Text style={styles.subtitle}>Private by default. Quantum ready.</Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>RON1N SECURITY SCORE</Text>
            <Text style={styles.score}>92</Text>
            <Text style={styles.scoreOutOf}>/ 100</Text>
          </View>

          <View style={styles.grid}>
            <StatusTile title="BIOMETRIC VAULT" status="ACTIVE" />
            <StatusTile title="SECURESTORE" status="PROTECTED" />
            <StatusTile title="SCREEN CAPTURE" status="BLOCKED" />
            <StatusTile title="SYN-ID" status="ACTIVE" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>POST-QUANTUM ROADMAP</Text>
            <Text style={styles.cardText}>ML-DSA signatures</Text>
            <Text style={styles.cardText}>ML-KEM secure exchange</Text>
            <Text style={styles.cardText}>liboqs native bridge</Text>
            <Text style={styles.pending}>STATUS: DEVELOPMENT</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>ASSET SECURITY STATES</Text>
            <Text style={styles.green}>● PQ PROTECTED — inside Ron1n</Text>
            <Text style={styles.yellow}>● PQ VERIFIED — proof exists externally</Text>
            <Text style={styles.red}>● STANDARD EXTERNAL — public chain rules apply</Text>
          </View>

          <View style={styles.historyHeader}>
            <Text style={styles.cardTitle}>PRIVATE ACTIVITY</Text>
            <TouchableOpacity onPress={clearHistory}>
              <Text style={styles.clearText}>CLEAR</Text>
            </TouchableOpacity>
          </View>

          {activities.length === 0 ? (
            <Text style={styles.empty}>No private activity yet.</Text>
          ) : (
            activities.map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityDetail}>{item.detail}</Text>
                <Text style={styles.activityTime}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function StatusTile({ title, status }: { title: string; status: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileStatus}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, padding: 20 },
  title: {
    color: '#B026FF',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'KatakanaStyle',
    marginTop: 20,
  },
  subtitle: {
    color: '#777',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 22,
    fontFamily: 'KatakanaStyle',
  },
  scoreCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#222',
  },
  scoreLabel: { color: '#777', fontSize: 10, fontFamily: 'KatakanaStyle' },
  score: {
    color: '#00FF41',
    fontSize: 64,
    fontWeight: '900',
    textShadowColor: '#00FF41',
    textShadowRadius: 14,
  },
  scoreOutOf: { color: '#777', marginTop: -8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  tile: {
    width: '48%',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 16,
    padding: 14,
  },
  tileTitle: { color: '#777', fontSize: 9, fontFamily: 'KatakanaStyle' },
  tileStatus: { color: '#00FF41', fontSize: 11, marginTop: 8, fontFamily: 'KatakanaStyle' },
  card: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 18,
    padding: 16,
  },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: '900', fontFamily: 'KatakanaStyle' },
  cardText: { color: '#aaa', fontSize: 12, marginTop: 10, fontFamily: 'KatakanaStyle' },
  pending: { color: '#B026FF', fontSize: 11, marginTop: 14, fontFamily: 'KatakanaStyle' },
  green: { color: '#00FF41', marginTop: 12, fontSize: 11 },
  yellow: { color: '#ffcc00', marginTop: 8, fontSize: 11 },
  red: { color: '#FF3366', marginTop: 8, fontSize: 11 },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    alignItems: 'center',
  },
  clearText: { color: '#FF3366', fontSize: 11, fontFamily: 'KatakanaStyle' },
  empty: { color: '#666', marginTop: 16 },
  activityRow: {
    marginTop: 12,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 14,
  },
  activityTitle: { color: '#00FF41', fontSize: 12, fontFamily: 'KatakanaStyle' },
  activityDetail: { color: '#aaa', fontSize: 11, marginTop: 6 },
  activityTime: { color: '#555', fontSize: 10, marginTop: 8 },
});