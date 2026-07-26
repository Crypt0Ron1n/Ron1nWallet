import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { ActivityService, type Ron1nActivity } from '../services/transactions/ActivityService';
import {
  ChainActivityCacheService,
  type CachedChainActivity,
} from '../services/transactions/ChainActivityCacheService';
import {
  ExposureScannerService,
  type AssetExposureReport,
  type ExposureLevel,
  type PortfolioExposureReport,
} from '../services/security/ExposureScannerService';
import {
  AddressRotationPrepService,
  type AddressRotationPrepRecord,
  type RotationPrepStatus,
} from '../services/security/AddressRotationPrepService';
import { Ron1nColors } from '../theme/ron1nTheme';

function calculateSecurityScore(report: PortfolioExposureReport | null): number {
  if (!report || report.totalAssetsScanned === 0) {
    return 82;
  }

  let score = 96;

  report.reports.forEach((item) => {
    if (item.exposureLevel === 'ELEVATED') {
      score -= 10;
    }

    if (item.exposureLevel === 'UNKNOWN') {
      score -= 6;
    }

    if (item.exposureLevel === 'LOW') {
      score -= 3;
    }
  });

  if (report.failedAssets > 0) {
    score -= report.failedAssets * 2;
  }

  return Math.max(35, Math.min(99, score));
}

function scoreLabel(score: number) {
  if (score >= 90) return 'STRONG';
  if (score >= 75) return 'WATCHFUL';
  if (score >= 60) return 'ROTATION ADVISED';
  return 'ELEVATED RISK';
}

function exposureColor(level: ExposureLevel) {
  if (level === 'FRESH') return Ron1nColors.green;
  if (level === 'LOW') return Ron1nColors.gold;
  if (level === 'ELEVATED') return Ron1nColors.red;
  return Ron1nColors.gray;
}

function exposureStatusText(level: ExposureLevel) {
  if (level === 'FRESH') return 'FRESH';
  if (level === 'LOW') return 'LOW EXPOSURE';
  if (level === 'ELEVATED') return 'ROTATION RECOMMENDED';
  return 'UNKNOWN';
}

function rotationStatusColor(status: RotationPrepStatus) {
  if (status === 'PREPARED') return Ron1nColors.gold;
  if (status === 'COMPLETED') return Ron1nColors.green;
  return '#999999';
}

export default function SecurityScreen() {
  const [activities, setActivities] = useState<Ron1nActivity[]>([]);
  const [chainCache, setChainCache] = useState<Record<string, CachedChainActivity>>({});
  const [portfolioReport, setPortfolioReport] = useState<PortfolioExposureReport | null>(null);
  const [rotationRecords, setRotationRecords] = useState<AddressRotationPrepRecord[]>([]);
  const [score, setScore] = useState(82);

  const load = async () => {
    try {
      const [activityData, cacheData, rotationData] = await Promise.all([
        ActivityService.getActivities(),
        ChainActivityCacheService.getCache(),
        AddressRotationPrepService.getAll(),
      ]);

      const report = ExposureScannerService.scanPortfolio(cacheData);

      setActivities(activityData);
      setChainCache(cacheData);
      setPortfolioReport(report);
      setRotationRecords(rotationData);
      setScore(calculateSecurityScore(report));
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

  const runExposureScan = async () => {
    try {
      const cache = await ChainActivityCacheService.getCache();
      const cacheCount = Object.keys(cache).length;

      if (cacheCount === 0) {
        Alert.alert(
          'Manual Sync Required',
          'Go to Wallet, enable Manual Sync, and sync public-chain activity before running exposure analysis.'
        );
        return;
      }

      const report = ExposureScannerService.scanPortfolio(cache);

      setChainCache(cache);
      setPortfolioReport(report);
      setScore(calculateSecurityScore(report));

      await ActivityService.addActivity(
        'SECURITY',
        'Exposure Scan Complete',
        `${report.totalAssetsScanned} assets scanned. ${report.activeAssets} active assets detected.`
      );

      Alert.alert(
        'Exposure Scan Complete',
        `${report.totalAssetsScanned} assets scanned. Overall status: ${exposureStatusText(
          report.overallLevel
        )}.`
      );

      await load();
    } catch (error) {
      console.error('Exposure scan failed:', error);

      await ActivityService.addActivity(
        'ERROR',
        'Exposure Scan Failed',
        'Unable to complete cached chain exposure scan'
      );

      Alert.alert('Scan Failed', 'Unable to complete exposure scan.');
    }
  };

  const prepareRotation = async (report: AssetExposureReport) => {
    try {
      const record = await AddressRotationPrepService.prepare(report);

      await ActivityService.addActivity(
        'SECURITY',
        `${report.symbol} Rotation Prepared`,
        `${record.recommendedLabel} prepared locally. No funds moved.`
      );

      Alert.alert(
        'Fresh Receive Address Prepared',
        `${record.recommendedLabel}\n\n${record.safetyNote}`
      );

      await load();
    } catch (error) {
      console.error('Prepare rotation failed:', error);

      await ActivityService.addActivity(
        'ERROR',
        `${report.symbol} Rotation Prep Failed`,
        'Unable to prepare local address rotation record'
      );

      Alert.alert('Rotation Prep Failed', `Unable to prepare ${report.symbol} rotation.`);
    }
  };

  const updateRotationStatus = async (
    record: AddressRotationPrepRecord,
    status: RotationPrepStatus
  ) => {
    try {
      await AddressRotationPrepService.updateStatus(record.id, status);

      await ActivityService.addActivity(
        'SECURITY',
        `${record.symbol} Rotation ${status}`,
        `${record.recommendedLabel} marked ${status.toLowerCase()} locally.`
      );

      await load();
    } catch (error) {
      console.error('Rotation status update failed:', error);
      Alert.alert('Update Failed', 'Unable to update rotation prep status.');
    }
  };

  const clearRotationPreps = async () => {
    Alert.alert(
      'Clear Rotation Prep Records',
      'This clears local rotation prep records only. It does not affect your wallet, addresses, assets, or blockchain history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AddressRotationPrepService.clearAll();

              await ActivityService.addActivity(
                'SECURITY',
                'Rotation Prep Records Cleared',
                'User cleared local address rotation prep records'
              );

              await load();
            } catch (error) {
              Alert.alert('Error', 'Unable to clear rotation prep records.');
            }
          },
        },
      ]
    );
  };

  const latestSyncTime = portfolioReport?.reports
    ?.map((item) => item.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  const exposureReports = portfolioReport?.reports || [];
  const hasCache = Object.keys(chainCache).length > 0;

  return (
    <Ron1nScreen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />
          <Text style={styles.title}>SECURITY LAYER</Text>
          <Text style={styles.subtitle}>EXPOSURE + ADDRESS HYGIENE</Text>
        </View>

        <Ron1nCard>
          <Text style={styles.scoreLabel}>RON1N SECURITY SCORE</Text>

          <View style={styles.scoreRow}>
            <Text style={styles.score}>{score}</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>

          <Text style={styles.scoreStatus}>{scoreLabel(score)}</Text>

          <Text style={styles.scoreDetail}>
            This score is based on local vault posture and cached public-chain exposure
            data from user-approved manual syncs.
          </Text>
        </Ron1nCard>

        <View style={styles.grid}>
          <StatusTile title="VAULT" status="SECURED" color={Ron1nColors.green} />
          <StatusTile title="BIOMETRICS" status="ACTIVE" color={Ron1nColors.green} />
          <StatusTile
            title="EXPOSURE"
            status={portfolioReport ? exposureStatusText(portfolioReport.overallLevel) : 'NO SCAN'}
            color={portfolioReport ? exposureColor(portfolioReport.overallLevel) : Ron1nColors.gray}
          />
          <StatusTile
            title="ROTATION"
            status={rotationRecords.length > 0 ? `${rotationRecords.length} PREP` : 'NONE'}
            color={rotationRecords.length > 0 ? Ron1nColors.gold : Ron1nColors.gray}
          />
        </View>

        <Ron1nCard>
          <Text style={styles.cardTitle}>EXPOSURE SCANNER</Text>

          <Text style={styles.cardText}>
            Ron1n reviews cached public-chain history to estimate address exposure.
            It does not claim assets are quantum-proof, and it does not move funds.
          </Text>

          {latestSyncTime ? (
            <Text style={styles.syncText}>
              Last cached sync: {new Date(latestSyncTime).toLocaleString()}
            </Text>
          ) : (
            <Text style={styles.syncText}>
              No cached sync yet. Run Manual Sync from Wallet first.
            </Text>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={runExposureScan}>
            <Text style={styles.primaryButtonText}>RUN EXPOSURE SCAN</Text>
          </TouchableOpacity>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>PORTFOLIO READINESS</Text>

          {!portfolioReport || !hasCache ? (
            <Text style={styles.cardText}>
              No chain activity cache found. Open Wallet, enable Manual Sync, approve
              the privacy notice, then return here to scan exposure.
            </Text>
          ) : (
            <>
              <View style={styles.metricRow}>
                <Metric label="SCANNED" value={String(portfolioReport.totalAssetsScanned)} />
                <Metric label="ACTIVE" value={String(portfolioReport.activeAssets)} />
                <Metric label="FAILED" value={String(portfolioReport.failedAssets)} />
              </View>

              <Text style={styles.cardText}>
                Overall exposure level: {exposureStatusText(portfolioReport.overallLevel)}.
              </Text>
            </>
          )}
        </Ron1nCard>

        {exposureReports.length > 0 ? (
          exposureReports.map((item) => (
            <ExposureCard
              key={item.symbol}
              report={item}
              onPrepareRotation={prepareRotation}
            />
          ))
        ) : (
          <Ron1nCard>
            <Text style={styles.cardTitle}>NO ASSET EXPOSURE REPORTS</Text>
            <Text style={styles.cardText}>
              Exposure reports will appear here after Wallet Manual Sync and Run Exposure Scan.
            </Text>
          </Ron1nCard>
        )}

        <Ron1nCard>
          <View style={styles.rotationHeader}>
            <Text style={styles.cardTitle}>PREPARED FRESH RECEIVE ADDRESSES</Text>

            {rotationRecords.length > 0 ? (
              <TouchableOpacity onPress={clearRotationPreps}>
                <Text style={styles.clearText}>CLEAR</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.cardText}>
            These are local preparation records only. They do not move funds, sign
            transactions, broadcast transactions, or custody assets.
          </Text>

          {rotationRecords.length === 0 ? (
            <Text style={styles.emptyPrep}>No rotation prep records yet.</Text>
          ) : (
            <View style={styles.rotationList}>
              {rotationRecords.map((record) => (
                <RotationPrepCard
                  key={record.id}
                  record={record}
                  onDismiss={() => updateRotationStatus(record, 'DISMISSED')}
                  onComplete={() => updateRotationStatus(record, 'COMPLETED')}
                />
              ))}
            </View>
          )}
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>RON1N IS A SECURITY LAYER</Text>
          <Text style={styles.cardText}>
            Your assets remain BTC, ETH, XRP, SOL, and the networks you already use.
            Ron1n provides exposure analysis, address hygiene, security scoring, and
            quantum migration readiness.
          </Text>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>POST-QUANTUM VAULT ROADMAP</Text>
          <Text style={styles.cardText}>
            Native post-quantum vault wrapping is a roadmap layer. Current protection
            uses SecureStore, biometric access, recovery phrase controls, exposure
            visibility, and address rotation guidance.
          </Text>
          <Text style={styles.pending}>STATUS: NATIVE BRIDGE REQUIRED</Text>
        </Ron1nCard>

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>RECENT PRIVATE ACTIVITY</Text>
        </View>

        {activities.length === 0 ? (
          <Text style={styles.empty}>No private activity yet.</Text>
        ) : (
          activities.slice(0, 8).map((item) => (
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
    </Ron1nScreen>
  );
}

function ExposureCard({
  report,
  onPrepareRotation,
}: {
  report: AssetExposureReport;
  onPrepareRotation: (report: AssetExposureReport) => void;
}) {
  const color = exposureColor(report.exposureLevel);
  const showRotationButton =
    report.exposureLevel === 'LOW' || report.exposureLevel === 'ELEVATED';

  return (
    <Ron1nCard>
      <View style={styles.exposureHeader}>
        <View>
          <Text style={styles.assetTitle}>{report.symbol}</Text>
          {report.lastSyncedAt ? (
            <Text style={styles.activityTime}>
              Synced: {new Date(report.lastSyncedAt).toLocaleString()}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.exposureBadge, { color }]}>
          {exposureStatusText(report.exposureLevel)}
        </Text>
      </View>

      <Text style={styles.cardText}>{report.headline}</Text>
      <Text style={styles.cardText}>{report.detail}</Text>

      <View style={styles.exposureMetaRow}>
        <Text style={styles.metaPill}>TX: {report.transactionCount}</Text>
        <Text style={styles.metaPill}>PROVIDER: {report.providerStatus}</Text>
      </View>

      <Text style={styles.recommendationTitle}>RECOMMENDATION</Text>
      <Text style={styles.recommendation}>{report.recommendation}</Text>

      {showRotationButton ? (
        <TouchableOpacity
          style={styles.rotationButton}
          onPress={() => onPrepareRotation(report)}
        >
          <Text style={styles.rotationButtonText}>
            PREPARE FRESH RECEIVE ADDRESS
          </Text>
        </TouchableOpacity>
      ) : null}

      {report.exposureLevel === 'FRESH' ? (
        <Text style={styles.freshNote}>
          Fresh state detected. Rotation is optional.
        </Text>
      ) : null}

      {report.exposureLevel === 'UNKNOWN' ? (
        <Text style={styles.unknownNote}>
          Retry Manual Sync before relying on this address status.
        </Text>
      ) : null}
    </Ron1nCard>
  );
}

function RotationPrepCard({
  record,
  onDismiss,
  onComplete,
}: {
  record: AddressRotationPrepRecord;
  onDismiss: () => void;
  onComplete: () => void;
}) {
  const active = record.status === 'PREPARED';

  return (
    <View style={styles.rotationPrepCard}>
      <View style={styles.rotationPrepHeader}>
        <View style={styles.rotationPrepTitleWrap}>
          <Text style={styles.rotationSymbol}>{record.symbol}</Text>
          <Text style={styles.rotationLabel}>{record.recommendedLabel}</Text>
        </View>

        <Text style={[styles.rotationStatus, { color: rotationStatusColor(record.status) }]}>
          {record.status}
        </Text>
      </View>

      <Text style={styles.rotationReason}>{record.reason}</Text>

      <Text style={styles.rotationSafety}>{record.safetyNote}</Text>

      <View style={styles.exposureMetaRow}>
        <Text style={styles.metaPill}>TX: {record.transactionCount}</Text>
        <Text style={styles.metaPill}>EXPOSURE: {record.exposureLevel}</Text>
      </View>

      <Text style={styles.activityTime}>
        Created: {new Date(record.createdAt).toLocaleString()}
      </Text>

      {active ? (
        <View style={styles.rotationActionRow}>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissButtonText}>DISMISS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.completeButton} onPress={onComplete}>
            <Text style={styles.completeButtonText}>MARK COMPLETED</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
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
  content: {
    paddingBottom: 120,
  },
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
    textAlign: 'center',
  },
  subtitle: {
    color: Ron1nColors.gray,
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'KatakanaStyle',
    textAlign: 'center',
    letterSpacing: 2,
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
    letterSpacing: 2,
  },
  scoreDetail: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 12,
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
    letterSpacing: 1,
  },
  cardText: {
    color: '#AAAAAA',
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },
  syncText: {
    color: Ron1nColors.gold,
    fontSize: 11,
    marginTop: 14,
    lineHeight: 17,
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
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  metricBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#00FF4133',
    backgroundColor: '#00FF4110',
    padding: 12,
    alignItems: 'center',
  },
  metricValue: {
    color: Ron1nColors.green,
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#999999',
    fontSize: 9,
    marginTop: 4,
    fontWeight: '900',
  },
  exposureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  assetTitle: {
    color: Ron1nColors.white,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  exposureBadge: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
    textAlign: 'right',
    maxWidth: 145,
  },
  exposureMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaPill: {
    color: Ron1nColors.green,
    fontSize: 10,
    fontWeight: '900',
    borderWidth: 1,
    borderColor: '#00FF4144',
    backgroundColor: '#00FF4110',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recommendationTitle: {
    color: Ron1nColors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 14,
  },
  recommendation: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  rotationButton: {
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFD70088',
    backgroundColor: '#FFD70018',
    paddingVertical: 12,
    alignItems: 'center',
  },
  rotationButtonText: {
    color: Ron1nColors.gold,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
    letterSpacing: 1,
  },
  freshNote: {
    color: Ron1nColors.green,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
  },
  unknownNote: {
    color: '#AAAAAA',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
  },
  rotationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  clearText: {
    color: Ron1nColors.red,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  emptyPrep: {
    color: Ron1nColors.gray,
    marginTop: 16,
    fontSize: 12,
  },
  rotationList: {
    gap: 12,
    marginTop: 16,
  },
  rotationPrepCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD70033',
    backgroundColor: '#000000',
    padding: 14,
  },
  rotationPrepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  rotationPrepTitleWrap: {
    flex: 1,
  },
  rotationSymbol: {
    color: Ron1nColors.gold,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  rotationLabel: {
    color: Ron1nColors.green,
    fontSize: 10,
    marginTop: 6,
    fontWeight: '900',
  },
  rotationStatus: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  rotationReason: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  rotationSafety: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
  },
  rotationActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  dismissButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#777777',
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#BBBBBB',
    fontSize: 10,
    fontWeight: '900',
  },
  completeButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#00FF4166',
    backgroundColor: '#00FF4110',
    paddingVertical: 10,
    alignItems: 'center',
  },
  completeButtonText: {
    color: Ron1nColors.green,
    fontSize: 10,
    fontWeight: '900',
  },
  pending: {
    color: Ron1nColors.gold,
    fontSize: 11,
    marginTop: 14,
    fontFamily: 'KatakanaStyle',
  },
  historyHeader: {
    marginTop: 10,
  },
  sectionTitle: {
    color: Ron1nColors.white,
    fontSize: 14,
    fontWeight: '900',
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