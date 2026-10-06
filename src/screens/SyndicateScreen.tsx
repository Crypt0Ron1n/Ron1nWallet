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
import { VaultService } from '../services/VaultService';
import { PrivacyModeService } from '../services/PrivacyModeService';
import { PriceService } from '../services/PriceService';
import { ActivityService, type Ron1nActivity } from '../services/transactions/ActivityService';
import { ChainActivityCacheService } from '../services/transactions/ChainActivityCacheService';
import { ExposureScannerService, type ExposureLevel } from '../services/security/ExposureScannerService';
import { ReceiveIdentityService } from '../services/identity/ReceiveIdentityService';
import { PrivacyAssessmentService } from '../services/privacy/PrivacyAssessmentService';
import type { PrivacyLevel } from '../services/privacy/PrivacyTypes';
import { WALLET_ASSETS } from '../config/assetCatalog';
import {
  Ron1nColors,
  Ron1nSpacing,
  Ron1nTypography,
  type Ron1nStatusTone,
} from '../theme/ron1nTheme';

const ACCOUNT_ID = 'primary';
const MARKET_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'HBAR'];
const PRICED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP'];

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
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(true);
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

  useEffect(() => {
    void load();
    void (async () => {
      setPricesLoading(true);
      setPrices(await PriceService.getUsdPrices(PRICED_SYMBOLS));
      setPricesLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
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

        <Text style={styles.sectionTitle}>MARKETS</Text>
        <Ron1nCard>
          {MARKET_SYMBOLS.map((symbol) => {
            const price = prices[symbol];
            const priceable = PRICED_SYMBOLS.includes(symbol);

            return (
              <View key={symbol} style={styles.row}>
                <Text style={styles.rowLabel}>{symbol}</Text>
                {!priceable ? (
                  <Ron1nStatusBadge tone="neutral" label="NOT YET AVAILABLE" />
                ) : pricesLoading ? (
                  <Text style={styles.rowMuted}>LOADING…</Text>
                ) : typeof price === 'number' ? (
                  <Text style={styles.rowValue}>
                    ${price.toLocaleString('en-US', { maximumFractionDigits: price < 1 ? 4 : 2 })}
                  </Text>
                ) : (
                  <Text style={styles.rowMuted}>NO DATA</Text>
                )}
              </View>
            );
          })}
        </Ron1nCard>

        <Text style={styles.sectionTitle}>PORTFOLIO</Text>
        <Ron1nCard>
          {WALLET_ASSETS.map((asset) => (
            <TouchableOpacity
              key={asset.symbol}
              style={styles.row}
              onPress={openWallet}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Open ${asset.name} in Shogun Wallet`}
            >
              <View>
                <Text style={styles.rowLabel}>{asset.symbol}</Text>
                <Text style={styles.rowSubLabel}>{asset.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#666670" />
            </TouchableOpacity>
          ))}
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
