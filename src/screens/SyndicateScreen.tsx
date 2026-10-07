import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nScreenHeader from '../components/Ron1nScreenHeader';
import Ron1nStatusBadge from '../components/Ron1nStatusBadge';
import Ron1nEmptyState from '../components/Ron1nEmptyState';
import Ron1nButton from '../components/Ron1nButton';
import Ron1nSparkline from '../components/Ron1nSparkline';
import { VaultService } from '../services/VaultService';
import { PrivacyModeService } from '../services/PrivacyModeService';
import { ActivityService, type Ron1nActivity } from '../services/transactions/ActivityService';
import { ChainActivityCacheService } from '../services/transactions/ChainActivityCacheService';
import { ExposureScannerService, type ExposureLevel } from '../services/security/ExposureScannerService';
import { ReceiveIdentityService } from '../services/identity/ReceiveIdentityService';
import { PrivacyAssessmentService } from '../services/privacy/PrivacyAssessmentService';
import type { PrivacyLevel } from '../services/privacy/PrivacyTypes';
import {
  SyndicateMarketService,
  type SyndicateMarketRow,
} from '../services/syndicate/SyndicateMarketService';
import {
  Ron1nColors,
  Ron1nSpacing,
  Ron1nTypography,
  type Ron1nStatusTone,
} from '../theme/ron1nTheme';

const ACCOUNT_ID = 'primary';

function formatTimeAgoShort(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const EXPOSURE_TONE: Record<ExposureLevel, Ron1nStatusTone> = {
  FRESH: 'success',
  LOW: 'info',
  ELEVATED: 'danger',
  UNKNOWN: 'neutral',
};

const PRIVACY_TONE: Record<PrivacyLevel, Ron1nStatusTone> = {
  PUBLIC: 'neutral',
  SEPARATED: 'info',
  PRIVATE: 'success',
  MAXIMUM_AVAILABLE: 'success',
};

const PRIVACY_LABEL: Record<PrivacyLevel, string> = {
  PUBLIC: 'PUBLIC',
  SEPARATED: 'SEPARATED',
  PRIVATE: 'PRIVATE',
  MAXIMUM_AVAILABLE: 'MAXIMUM AVAILABLE',
};

function trendForRow(row: SyndicateMarketRow): 'up' | 'down' | 'flat' {
  if (row.change24h !== null) {
    if (row.change24h > 0) return 'up';
    if (row.change24h < 0) return 'down';
    return 'flat';
  }

  // No 24h figure from the provider - fall back to the sparkline's own
  // first-vs-last movement so the chart color still matches its own shape.
  if (row.sparkline && row.sparkline.length >= 2) {
    const [first] = row.sparkline;
    const last = row.sparkline[row.sparkline.length - 1];
    if (last > first) return 'up';
    if (last < first) return 'down';
  }

  return 'flat';
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'JUST NOW';
  if (minutes < 60) return `${minutes}M AGO`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;

  return `${Math.floor(hours / 24)}D AGO`;
}

export default function SyndicateScreen() {
  const navigation = useNavigation<any>();

  const [hasVault, setHasVault] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(true);
  const [marketRows, setMarketRows] = useState<SyndicateMarketRow[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketRefreshedAt, setMarketRefreshedAt] = useState<string | null>(null);
  const [activities, setActivities] = useState<Ron1nActivity[]>([]);
  const [exposureLevel, setExposureLevel] = useState<ExposureLevel | null>(null);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel | null>(null);

  const load = useCallback(async () => {
    try {
      const [vault, privacy, activityLog, chainCache] = await Promise.all([
        VaultService.hasVault(),
        PrivacyModeService.isEnabled(),
        ActivityService.getActivities(),
        ChainActivityCacheService.getCache(),
      ]);

      setHasVault(vault);
      setPrivacyMode(privacy);
      setActivities(activityLog);

      setExposureLevel(
        Object.keys(chainCache).length > 0
          ? ExposureScannerService.scanPortfolio(chainCache).overallLevel
          : null
      );

      if (vault) {
        const receive = await ReceiveIdentityService.getOrCreateIngressIdentity(ACCOUNT_ID, 'EVM', 0);
        const assessment = await PrivacyAssessmentService.assess(
          ACCOUNT_ID,
          'EVM',
          'ETH',
          receive.address.address
        );
        setPrivacyLevel(assessment.level);
      }
    } catch (error) {
      console.error('Failed to load Syndicate dashboard:', error);
    }
  }, []);

  const loadMarket = useCallback(async () => {
    try {
      setMarketLoading(true);
      // Market prices are public data - deliberately independent of whether
      // a vault exists. Syndicate never reads a wallet address or balance.
      const snapshot = await SyndicateMarketService.loadLive();
      setMarketRows(snapshot.rows);
      setMarketRefreshedAt(snapshot.refreshedAt);
    } catch (error) {
      console.error('Failed to load Syndicate market data:', error);
      setMarketRows([]);
      setMarketRefreshedAt(null);
    } finally {
      setMarketLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadMarket();
  }, [load, loadMarket]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadMarket();
    }, [load, loadMarket])
  );

  const recentActivity = activities.slice(0, 5);

  const openSend = () => navigation.navigate('Shogun', { screen: 'Send' });
  const openWallet = () => navigation.navigate('Shogun', { screen: 'Wallet' });
  const openSecurity = () => navigation.navigate('Security');
  const openAssetProtection = () => navigation.navigate('Shogun', { screen: 'AssetProtection' });

  return (
    <Ron1nScreen>
      <SafeAreaView style={styles.safe}>
        <Ron1nScreenHeader
          title="RON1N SYNDICATE"
          subtitle="SELF-CUSTODY • DEFI • SECURITY"
          accent="purple"
        />

        <Text style={styles.welcome}>
          {hasVault
            ? privacyMode
              ? 'Vault secured locally. Privacy Mode is on.'
              : 'Vault secured locally. Public-chain sync is enabled.'
            : 'No local vault yet. Set up Shogun Wallet to begin.'}
        </Text>

        <View style={styles.statusRow}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>SECURITY STATUS</Text>
            {exposureLevel ? (
              <Ron1nStatusBadge
                tone={EXPOSURE_TONE[exposureLevel]}
                label={exposureLevel === 'FRESH' ? 'PROTECTED' : exposureLevel}
              />
            ) : (
              <Ron1nStatusBadge tone="neutral" label="NO SCAN YET" />
            )}
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>PRIVACY STATUS</Text>
            {privacyLevel ? (
              <Ron1nStatusBadge tone={PRIVACY_TONE[privacyLevel]} label={PRIVACY_LABEL[privacyLevel]} />
            ) : (
              <Ron1nStatusBadge tone="neutral" label="NOT AVAILABLE" />
            )}
          </View>
        </View>

        <View style={styles.actionRow}>
          <QuickAction icon="arrow-up-circle-outline" label="SEND" color={Ron1nColors.white} onPress={openSend} />
          <QuickAction icon="qr-code-outline" label="RECEIVE" color={Ron1nColors.green} onPress={openWallet} />
          <QuickAction
            icon="shield-checkmark-outline"
            label="SECURITY"
            color={Ron1nColors.neonPurple}
            onPress={openSecurity}
          />
          <QuickAction
            icon="lock-closed-outline"
            label="PROTECTION"
            color={Ron1nColors.cyan}
            onPress={openAssetProtection}
          />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>MARKET</Text>
          {marketRefreshedAt ? (
            <Text style={styles.refreshedLabel}>
              UPDATED {formatTimeAgoShort(marketRefreshedAt).toUpperCase()}
            </Text>
          ) : null}
        </View>
        <Ron1nCard>
          {marketLoading ? (
            <Text style={styles.rowMuted}>LOADING MARKET DATA…</Text>
          ) : marketRows.length === 0 ? (
            <Ron1nEmptyState
              icon="alert-circle-outline"
              title="NOT AVAILABLE"
              message="Market data could not be loaded right now."
            />
          ) : (
            marketRows.map((row) => (
              <View key={row.symbol} style={styles.assetRow}>
                <View style={styles.assetRowTop}>
                  <View>
                    <Text style={styles.rowLabel}>{row.symbol}</Text>
                    <Text style={styles.rowSubLabel}>
                      {row.name} • {row.network}
                    </Text>
                  </View>

                  <View style={styles.assetValueBlock}>
                    {row.status === 'LIVE' && row.priceUsd !== null ? (
                      <Text style={styles.rowValue}>
                        ${row.priceUsd.toLocaleString('en-US', {
                          maximumFractionDigits: row.priceUsd < 1 ? 6 : 2,
                        })}
                      </Text>
                    ) : (
                      <Text style={styles.rowMuted}>NO PRICE DATA</Text>
                    )}
                    {row.status === 'LIVE' && row.change24h !== null ? (
                      <Text
                        style={[
                          styles.rowSubLabel,
                          {
                            color:
                              row.change24h > 0
                                ? Ron1nColors.green
                                : row.change24h < 0
                                  ? Ron1nColors.danger
                                  : Ron1nColors.muted,
                          },
                        ]}
                      >
                        {row.change24h >= 0 ? '+' : ''}
                        {row.change24h.toFixed(2)}% 24H
                      </Text>
                    ) : null}
                  </View>
                </View>

                {row.status === 'LIVE' && row.sparkline ? (
                  <View style={styles.sparklineRow}>
                    <Ron1nSparkline data={row.sparkline} trend={trendForRow(row)} />
                  </View>
                ) : null}

                <View style={styles.assetBadgeRow}>
                  <Ron1nStatusBadge
                    tone={row.status === 'LIVE' ? 'success' : 'neutral'}
                    label={row.status === 'LIVE' ? 'LIVE' : 'NO PRICE DATA'}
                  />
                </View>
              </View>
            ))
          )}
        </Ron1nCard>

        <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
        <Ron1nCard>
          {recentActivity.length === 0 ? (
            <Ron1nEmptyState
              icon="pulse-outline"
              title="NO ACTIVITY YET"
              message="Transactions and security events will appear here when activity occurs."
            />
          ) : (
            recentActivity.map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <Ionicons name="pulse-outline" size={16} color={Ron1nColors.neonPurple} />
                <View style={styles.activityText}>
                  <Text style={styles.rowLabel}>{item.title}</Text>
                  <Text style={styles.rowSubLabel}>{timeAgo(item.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </Ron1nCard>

        <View style={styles.footerButton}>
          <Ron1nButton label="OPEN SHOGUN WALLET" variant="secondary" icon="wallet-outline" onPress={openWallet} />
        </View>
      </SafeAreaView>
    </Ron1nScreen>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.actionCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.actionTitle, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  welcome: {
    ...Ron1nTypography.bodySecondary,
    color: Ron1nColors.gray,
    marginBottom: Ron1nSpacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Ron1nSpacing.sm,
    marginBottom: Ron1nSpacing.lg,
  },
  statusCard: {
    flex: 1,
    borderRadius: 18,
    padding: Ron1nSpacing.md,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    gap: Ron1nSpacing.sm,
  },
  statusLabel: {
    ...Ron1nTypography.label,
    color: Ron1nColors.gray,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Ron1nSpacing.sm,
    marginBottom: Ron1nSpacing.xl,
  },
  actionCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: 18,
    padding: Ron1nSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Ron1nSpacing.xs,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  actionTitle: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  sectionTitle: {
    ...Ron1nTypography.sectionTitle,
    color: Ron1nColors.white,
    marginBottom: Ron1nSpacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshedLabel: {
    ...Ron1nTypography.caption,
    color: Ron1nColors.muted,
    marginBottom: Ron1nSpacing.sm,
  },
  assetRow: {
    paddingVertical: Ron1nSpacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C22',
    gap: Ron1nSpacing.xs,
  },
  assetRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assetValueBlock: {
    alignItems: 'flex-end',
  },
  assetBadgeRow: {
    flexDirection: 'row',
    gap: Ron1nSpacing.xs,
    flexWrap: 'wrap',
  },
  sparklineRow: {
    marginTop: Ron1nSpacing.xs,
    marginBottom: Ron1nSpacing.xs,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Ron1nSpacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C22',
  },
  rowLabel: {
    ...Ron1nTypography.body,
    fontWeight: '800',
    color: Ron1nColors.white,
    flexShrink: 0,
  },
  rowSubLabel: {
    ...Ron1nTypography.caption,
    color: Ron1nColors.muted,
    marginTop: 2,
  },
  rowValue: {
    color: Ron1nColors.green,
    fontSize: 12,
    fontWeight: '900',
  },
  rowMuted: {
    ...Ron1nTypography.caption,
    color: Ron1nColors.muted,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Ron1nSpacing.sm + 2,
    paddingVertical: Ron1nSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C22',
  },
  activityText: { flex: 1 },
  footerButton: {
    marginTop: Ron1nSpacing.sm,
  },
});
