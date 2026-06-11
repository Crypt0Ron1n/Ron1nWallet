import React, { useCallback, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { ActivityService, Ron1nActivity } from '../services/ActivityService';
import {
  QuantumExposureRecord,
  QuantumExposureService,
} from '../services/QuantumExposureService';
import { SecurityScoreService } from '../services/SecurityScoreService';
import { AddressRotationService } from '../services/AddressRotationService';
import { QTokenService } from '../services/QTokenService';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function SecurityScreen() {
  const [activities, setActivities] = useState<Ron1nActivity[]>([]);
  const [exposure, setExposure] = useState<QuantumExposureRecord[]>([]);
  const [score, setScore] = useState(92);

  const load = async () => {
    const activityData = await ActivityService.getActivities();
    const exposureData = await QuantumExposureService.getAllExposure();
    setActivities(activityData);
    setExposure(exposureData);
    setScore(SecurityScoreService.calculate(exposureData));
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const runDemoScan = async () => {
    const demoAssets = [
      { symbol: 'ETH', address: 'Current ETH address' },
      { symbol: 'BTC', address: 'Current BTC address' },
      { symbol: 'LTC', address: 'Current LTC address' },
      { symbol: 'SOL', address: 'Current SOL address' },
    ];

    for (const asset of demoAssets) {
      await QuantumExposureService.scanAsset(asset.symbol, asset.address);
    }

    await ActivityService.addActivity(
      'SECURITY',
      'Quantum Exposure Scan',
      'Exposure scanner refreshed asset status'
    );

    await load();
  };

  const markEthExposedDemo = async () => {
    await QuantumExposureService.markExposed('ETH', 'Current ETH address');
    await ActivityService.addActivity(
      'SECURITY',
      'ETH Exposure Detected',
      'ETH marked as public-key exposed for scanner testing'
    );
    await load();
  };

  const rotateAsset = async (record: QuantumExposureRecord) => {
    const rotation = await AddressRotationService.prepareRotation(record.symbol, record.address);

    await ActivityService.addActivity(
      'SECURITY',
      `${record.symbol} Rotation Prepared`,
      rotation.newAddressLabel
    );

    await QuantumExposureService.markProtected(record.symbol, record.address);
    await QTokenService.enableQAsset(record.symbol);

    await ActivityService.addActivity(
      'SECURITY',
      `${record.symbol} Quantum Hardened`,
      `${record.symbol} is now displayed as q${record.symbol}`
    );

    await load();

    Alert.alert(
      'Quantum Hardened',
      `${record.symbol} has been marked as q${record.symbol}. Real transfer broadcast will connect later.`
    );
  };

  const clearHistory = async () => {
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Clear Ron1n Activity',
      fallbackLabel: 'Use device passcode',
    });

    if (!auth.success) return;

    await ActivityService.clearActivities();
    await load();
    Alert.alert('Cleared', 'Private activity history cleared.');
  };

  return (
    <Ron1nScreen>
      <SafeAreaView>
        <View style={styles.hero}>
          <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />
          <Text style={styles.title}>SECURITY CENTER</Text>
          <Text style={styles.subtitle}>Quantum readiness dashboard.</Text>
        </View>

        <Ron1nCard>
          <Text style={styles.scoreLabel}>RON1N READINESS SCORE</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{score}</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
          <Text style={styles.scoreStatus}>{SecurityScoreService.label(score)}</Text>
        </Ron1nCard>

        <View style={styles.grid}>
          <StatusTile title="BIOMETRIC VAULT" status="ACTIVE" color={Ron1nColors.green} />
          <StatusTile title="SECURESTORE" status="PROTECTED" color={Ron1nColors.green} />
          <StatusTile title="EXPOSURE SCAN" status="READY" color={Ron1nColors.blue} />
          <StatusTile title="ML-KEM VAULT" status="NEXT" color={Ron1nColors.gold} />
        </View>

        <Ron1nCard>
          <Text style={styles.cardTitle}>QUANTUM EXPOSURE SCANNER</Text>
          <Text style={styles.cardText}>
            Ron1n checks whether addresses appear unexposed or have signed outgoing transactions.
            RPC scanning connects next.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={runDemoScan}>
            <Text style={styles.primaryButtonText}>RUN SCAN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={markEthExposedDemo}>
            <Text style={styles.secondaryButtonText}>DEMO: MARK ETH EXPOSED</Text>
          </TouchableOpacity>
        </Ron1nCard>

        {exposure.map((item) => (
          <Ron1nCard key={item.symbol}>
            <View style={styles.exposureHeader}>
              <Text style={styles.assetTitle}>{item.symbol}</Text>
              <Text style={[styles.exposureBadge, badgeStyle(item.status)]}>{item.status}</Text>
            </View>

            <Text style={styles.cardText}>Public key exposed: {item.publicKeyExposed ? 'YES' : 'NO'}</Text>
            <Text style={styles.cardText}>Sent transactions: {item.hasSentTransactions ? 'YES' : 'NO'}</Text>
            <Text style={styles.cardText}>Recommendation: {item.recommendation}</Text>

            {(item.status === 'EXPOSED' || item.status === 'MIGRATION_READY') && (
              <TouchableOpacity style={styles.primaryButton} onPress={() => rotateAsset(item)}>
                <Text style={styles.primaryButtonText}>QUANTUM HARDEN</Text>
              </TouchableOpacity>
            )}

            {item.status === 'PROTECTED' && (
              <Text style={styles.protectedText}>q{item.symbol} ENABLED</Text>
            )}
          </Ron1nCard>
        ))}

        <Ron1nCard>
          <Text style={styles.cardTitle}>POST-QUANTUM VAULT</Text>
          <Text style={styles.cardText}>ML-KEM protected vault encryption is next.</Text>
          <Text style={styles.pending}>STATUS: WAITING FOR NATIVE BRIDGE SESSION</Text>
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

function badgeStyle(status: string) {
  if (status === 'UNEXPOSED') return { color: Ron1nColors.green };
  if (status === 'PROTECTED') return { color: Ron1nColors.gold };
  if (status === 'EXPOSED') return { color: Ron1nColors.red };
  return { color: Ron1nColors.blue };
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
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  logo: { width: 118, height: 118, resizeMode: 'contain', marginBottom: 8 },
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
  scoreRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' },
  score: {
    color: Ron1nColors.green,
    fontSize: 68,
    fontWeight: '900',
    textShadowColor: Ron1nColors.green,
    textShadowRadius: 16,
  },
  scoreOutOf: { color: Ron1nColors.gray, fontSize: 20, marginBottom: 14 },
  scoreStatus: {
    color: Ron1nColors.gold,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'KatakanaStyle',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  tile: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    padding: 14,
  },
  tileTitle: { color: Ron1nColors.gray, fontSize: 9, fontFamily: 'KatakanaStyle' },
  tileStatus: { fontSize: 11, marginTop: 8, fontFamily: 'KatakanaStyle' },
  cardTitle: {
    color: Ron1nColors.white,
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  cardText: { color: '#AAAAAA', fontSize: 12, marginTop: 10, lineHeight: 18 },
  pending: {
    color: Ron1nColors.gold,
    fontSize: 11,
    marginTop: 14,
    fontFamily: 'KatakanaStyle',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: Ron1nColors.green,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  secondaryButton: {
    marginTop: 10,
    borderColor: Ron1nColors.purple,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Ron1nColors.purple,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  exposureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assetTitle: {
    color: Ron1nColors.white,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  exposureBadge: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  protectedText: {
    color: Ron1nColors.gold,
    marginTop: 16,
    fontSize: 12,
    fontFamily: 'KatakanaStyle',
  },
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
  clearText: { color: Ron1nColors.red, fontSize: 11, fontFamily: 'KatakanaStyle' },
  empty: { color: Ron1nColors.gray, marginTop: 16 },
  activityRow: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: 14,
  },
  activityTitle: { color: Ron1nColors.green, fontSize: 12, fontFamily: 'KatakanaStyle' },
  activityDetail: { color: '#AAAAAA', fontSize: 11, marginTop: 6 },
  activityTime: { color: Ron1nColors.muted, fontSize: 10, marginTop: 8 },
});