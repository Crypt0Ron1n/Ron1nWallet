import React, { useCallback, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { ActivityService, Ron1nActivity } from '../services/ActivityService';
import { Ron1nColors } from '../theme/ron1nTheme';

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
    <Ron1nScreen>
      <SafeAreaView>
        <View style={styles.hero}>
          <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />
          <Text style={styles.title}>SECURITY CENTER</Text>
          <Text style={styles.subtitle}>Private by default. Quantum ready.</Text>
        </View>

        <Ron1nCard>
          <Text style={styles.scoreLabel}>RON1N SECURITY SCORE</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>92</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
          <Text style={styles.scoreStatus}>VAULT STATUS: LOW THREAT</Text>
        </Ron1nCard>

        <View style={styles.grid}>
          <StatusTile title="BIOMETRIC VAULT" status="ACTIVE" color={Ron1nColors.green} />
          <StatusTile title="SECURESTORE" status="PROTECTED" color={Ron1nColors.green} />
          <StatusTile title="SCREEN CAPTURE" status="BLOCKED" color={Ron1nColors.blue} />
          <StatusTile title="SYN-ID" status="ACTIVE" color={Ron1nColors.purple} />
        </View>

        <Ron1nCard>
          <Text style={styles.cardTitle}>POST-QUANTUM ROADMAP</Text>
          <Text style={styles.cardText}>ML-DSA ownership signatures</Text>
          <Text style={styles.cardText}>ML-KEM secure key exchange</Text>
          <Text style={styles.cardText}>liboqs native bridge</Text>
          <Text style={styles.pending}>STATUS: DEVELOPMENT</Text>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>ASSET SECURITY STATES</Text>
          <Text style={styles.green}>● PQ PROTECTED — inside Ron1n</Text>
          <Text style={styles.yellow}>● PQ VERIFIED — proof exists externally</Text>
          <Text style={styles.red}>● STANDARD EXTERNAL — public chain rules apply</Text>
        </Ron1nCard>

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>PRIVATE ACTIVITY</Text>
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
      </SafeAreaView>
    </Ron1nScreen>
  );
}

function StatusTile({
  title,
  status,
  color,
}: {
  title: string;
  status: string;
  color: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={[styles.tileStatus, { color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  logo: {
    width: 118,
    height: 118,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  title: {
    color: Ron1nColors.gold,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'KatakanaStyle',
  },
  subtitle: {
    color: Ron1nColors.gray,
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'KatakanaStyle',
  },
  scoreLabel: {
    color: Ron1nColors.gray,
    fontSize: 10,
    fontFamily: 'KatakanaStyle',
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  score: {
    color: Ron1nColors.green,
    fontSize: 68,
    fontWeight: '900',
    textShadowColor: Ron1nColors.green,
    textShadowRadius: 16,
  },
  scoreOutOf: {
    color: Ron1nColors.gray,
    fontSize: 20,
    marginBottom: 14,
  },
  scoreStatus: {
    color: Ron1nColors.gold,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'KatakanaStyle',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  tile: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    padding: 14,
  },
  tileTitle: {
    color: Ron1nColors.gray,
    fontSize: 9,
    fontFamily: 'KatakanaStyle',
  },
  tileStatus: {
    fontSize: 11,
    marginTop: 8,
    fontFamily: 'KatakanaStyle',
  },
  cardTitle: {
    color: Ron1nColors.white,
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  cardText: {
    color: '#AAAAAA',
    fontSize: 12,
    marginTop: 10,
    fontFamily: 'KatakanaStyle',
  },
  pending: {
    color: Ron1nColors.purple,
    fontSize: 11,
    marginTop: 14,
    fontFamily: 'KatakanaStyle',
  },
  green: { color: Ron1nColors.green, marginTop: 12, fontSize: 11 },
  yellow: { color: Ron1nColors.gold, marginTop: 8, fontSize: 11 },
  red: { color: Ron1nColors.red, marginTop: 8, fontSize: 11 },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    alignItems: 'center',
  },
  sectionTitle: {
    color: Ron1nColors.white,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  clearText: {
    color: Ron1nColors.red,
    fontSize: 11,
    fontFamily: 'KatakanaStyle',
  },
  empty: {
    color: Ron1nColors.gray,
    marginTop: 16,
  },
  activityRow: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: 14,
  },
  activityTitle: {
    color: Ron1nColors.green,
    fontSize: 12,
    fontFamily: 'KatakanaStyle',
  },
  activityDetail: {
    color: '#AAAAAA',
    fontSize: 11,
    marginTop: 6,
  },
  activityTime: {
    color: Ron1nColors.muted,
    fontSize: 10,
    marginTop: 8,
  },
});