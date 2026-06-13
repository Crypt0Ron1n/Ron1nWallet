import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { ActivityService, Ron1nActivity } from '../services/ActivityService';
import {
  ExposureStatus,
  QuantumExposureRecord,
  QuantumExposureService,
} from '../services/QuantumExposureService';
import { SecurityScoreService } from '../services/SecurityScoreService';
import { AddressRotationService } from '../services/AddressRotationService';
import { AssetSecurityService } from '../services/AssetSecurityService';
import { ProviderHealthService } from '../services/ProviderHealthService';
import { ChainProviderStatus } from '../services/providers/types';
import { Ron1nColors } from '../theme/ron1nTheme';

const DEMO_ASSETS = [
  { symbol: 'BTC', address: 'Current BTC address' },
  { symbol: 'ETH', address: 'Current ETH address' },
  { symbol: 'LTC', address: 'Current LTC address' },
  { symbol: 'SOL', address: 'Current SOL address' },
  { symbol: 'XRP', address: 'Current XRP address' },
  { symbol: 'XLM', address: 'Current XLM address' },
  { symbol: 'ALGO', address: 'Current ALGO address' },
];

export default function SecurityScreen() {
  const [activities, setActivities] = useState<Ron1nActivity[]>([]);
  const [exposure, setExposure] = useState<QuantumExposureRecord[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ChainProviderStatus[]>([]);
  const [score, setScore] = useState(92);

  const load = async () => {
    try {
      const activityData = await ActivityService.getActivities();
      const exposureData = await QuantumExposureService.getAllExposure();
      const providerData = await ProviderHealthService.getAllStatuses();

      setActivities(activityData);
      setExposure(exposureData);
      setProviderStatuses(providerData);

      setScore(
        SecurityScoreService.calculate({
          biometricsEnabled: true,
          vaultProtected: true,
          mnemonicBackedUp: true,
          records: exposureData,
          recentRotation: exposureData.some((item) => item.status === 'PROTECTED'),
        })
      );
    } catch (error) {
      console.error('Security screen load failed:', error);
      Alert.alert('Security Load Error', 'Unable to refresh Ron1n security data.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const runScan = async () => {
    try {
      for (const asset of DEMO_ASSETS) {
        await QuantumExposureService.scanAsset(asset.symbol, asset.address);
        await AssetSecurityService.setState(asset.symbol, 'QUANTUM_READY');
      }

      await ActivityService.addActivity(
        'SECURITY',
        'Quantum Exposure Scan',
        'Address exposure model refreshed'
      );

      await load();
    } catch (error) {
      console.error('Exposure scan failed:', error);
      Alert.alert('Scan Failed', 'Unable to complete exposure scan.');
    }
  };

  const simulateExposure = async () => {
    try {
      await QuantumExposureService.simulateActivity('ETH', 'Current ETH address', 8);
      await AssetSecurityService.setState('ETH', 'ROTATION_RECOMMENDED');

      await ActivityService.addActivity(
        'SECURITY',
        'ETH Exposure Simulated',
        'ETH address marked as exposed for testing'
      );

      await load();
    } catch (error) {
      console.error('Exposure simulation failed:', error);
      Alert.alert('Simulation Failed', 'Unable to simulate exposure.');
    }
  };

  const quantumHarden = async (record: QuantumExposureRecord) => {
    try {
      const rotation = await AddressRotationService.prepareRotation(
        record.symbol,
        record.address
      );

      await QuantumExposureService.markProtected(record.symbol, record.address);
      await AssetSecurityService.setState(record.symbol, 'PROTECTED');

      await ActivityService.addActivity(
        'SECURITY',
        `${record.symbol} Quantum Hardened`,
        `${rotation.newAddressLabel} prepared`
      );

      await load();

      Alert.alert(
        'Quantum Hardened',
        `${record.symbol} is now marked as protected. Live migration broadcast connects later.`
      );
    } catch (error) {
      console.error('Quantum harden failed:', error);
      Alert.alert('Harden Failed', `Unable to harden ${record.symbol}.`);
    }
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
          <Text style={styles.title}>SECURITY LAYER</Text>
          <Text style={styles.subtitle}>
            Not another token. A quantum readiness platform.
          </Text>
        </View>

        <Ron1nCard>
          <Text style={styles.scoreLabel}>RON1N SECURITY SCORE</Text>

          <View style={styles.scoreRow}>
            <Text style={styles.score}>{score}</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>

          <Text style={styles.scoreStatus}>{SecurityScoreService.label(score)}</Text>
        </Ron1nCard>

        <View style={styles.grid}>
          <StatusTile title="VAULT" status="SECURED" color={Ron1nColors.green} />
          <StatusTile title="BIOMETRICS" status="ACTIVE" color={Ron1nColors.green} />
          <StatusTile title="EXPOSURE" status="SCANNER" color={Ron1nColors.blue} />
          <StatusTile title="ML-KEM" status="NEXT" color={Ron1nColors.gold} />
        </View>

        <Ron1nCard>
          <Text style={styles.cardTitle}>PROVIDER INFRASTRUCTURE</Text>
          <Text style={styles.cardText}>
            ProviderFactory is installed. Live RPC connections, balances, history,
            and real exposure analysis plug into this layer next.
          </Text>

          {providerStatuses.length === 0 ? (
            <Text style={styles.emptyProvider}>No provider statuses loaded.</Text>
          ) : (
            providerStatuses.slice(0, 12).map((provider, index) => (
              <View
                key={`${provider.chain}-${provider.family}-${index}`}
                style={styles.providerRow}
              >
                <Text style={styles.providerChain}>{provider.chain}</Text>
                <Text style={styles.providerMode}>
                  {provider.family} / {provider.mode}
                </Text>
              </View>
            ))
          )}
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>RON1N IS A SECURITY LAYER</Text>
          <Text style={styles.cardText}>
            Your assets remain BTC, ETH, XRP, SOL and the networks you already use.
            Ron1n provides exposure analysis, address hygiene, security scoring,
            and quantum migration readiness.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={runScan}>
            <Text style={styles.primaryButtonText}>RUN EXPOSURE SCAN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={simulateExposure}>
            <Text style={styles.secondaryButtonText}>
              DEMO: SIMULATE ETH EXPOSURE
            </Text>
          </TouchableOpacity>
        </Ron1nCard>

        {exposure.map((item) => (
          <Ron1nCard key={item.symbol}>
            <View style={styles.exposureHeader}>
              <Text style={styles.assetTitle}>{item.symbol}</Text>
              <Text style={[styles.exposureBadge, { color: exposureColor(item.status) }]}>
                {item.status}
              </Text>
            </View>

            <Text style={styles.cardText}>
              Public key exposed: {item.publicKeyExposed ? 'YES' : 'NO'}
            </Text>
            <Text style={styles.cardText}>
              Sent transactions: {item.hasSentTransactions ? 'YES' : 'NO'}
            </Text>
            <Text style={styles.cardText}>Transaction count: {item.txCount}</Text>
            <Text style={styles.cardText}>Recommendation: {item.recommendation}</Text>

            {(item.status === 'EXPOSED' ||
              item.status === 'WATCHLIST' ||
              item.status === 'ROTATION_RECOMMENDED') && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => quantumHarden(item)}
              >
                <Text style={styles.primaryButtonText}>QUANTUM HARDEN ADDRESS</Text>
              </TouchableOpacity>
            )}

            {item.status === 'PROTECTED' && (
              <Text style={styles.protectedText}>PROTECTED ADDRESS STATE</Text>
            )}
          </Ron1nCard>
        ))}

        <Ron1nCard>
          <Text style={styles.cardTitle}>POST-QUANTUM VAULT</Text>
          <Text style={styles.cardText}>
            ML-KEM vault wrapping is next. Until then, Ron1n protects keys with
            SecureStore, biometric access, exposure visibility, and address rotation
            architecture.
          </Text>
          <Text style={styles.pending}>STATUS: NATIVE BRIDGE REQUIRED</Text>
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

function exposureColor(status: ExposureStatus) {
  if (status === 'SAFE') return Ron1nColors.green;
  if (status === 'PROTECTED') return Ron1nColors.gold;
  if (status === 'WATCHLIST') return Ron1nColors.blue;
  if (status === 'EXPOSED') return Ron1nColors.red;
  if (status === 'ROTATION_RECOMMENDED') return Ron1nColors.red;
  return Ron1nColors.gray;
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
    textAlign: 'center',
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
    lineHeight: 18,
  },
  providerRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingBottom: 8,
  },
  providerChain: {
    color: Ron1nColors.green,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  providerMode: {
    color: Ron1nColors.gray,
    fontSize: 10,
    fontFamily: 'KatakanaStyle',
  },
  emptyProvider: {
    color: Ron1nColors.gray,
    fontSize: 11,
    marginTop: 12,
  },
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
  exposureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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