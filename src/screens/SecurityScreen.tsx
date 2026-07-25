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

export default function SecurityScreen() {
  const [activities, setActivities] = useState<Ron1nActivity[]>([]);
  const [chainCache, setChainCache] = useState<Record<string, CachedChainActivity>>({});
  const [portfolioReport, setPortfolioReport] = useState<PortfolioExposureReport | null>(null);
  const [score, setScore] = useState(82);

  const load = async () => {
    try {
      const [activityData, cacheData] = await Promise.all([
        ActivityService.getActivities(),
        ChainActivityCacheService.getCache(),
      ]);

      const report = ExposureScannerService.scanPortfolio(cacheData);

      setActivities(activityData);
      setChainCache(cacheData);
      setPortfolioReport(report);
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
          <StatusTile title="PQ VAULT" status="ROADMAP" color={Ron1nColors.gold} />
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
          exposureReports.map((item) => <ExposureCard key={item.symbol} report={item} />)
        ) : (
          <Ron1nCard>
            <Text style={styles.cardTitle}>NO ASSET EXPOSURE REPORTS</Text>
            <Text style={styles.cardText}>
              Exposure reports will appear here after Wallet Manual Sync and Run Exposure Scan.
            </Text>
          </Ron1nCard>
        )}

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

function ExposureCard({ report }: { report: AssetExposureReport }) {
  const color = exposureColor(report.exposureLevel);

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
    </Ron1nCard>
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