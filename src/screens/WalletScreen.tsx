import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import ManualSyncConsentModal from '../components/ManualSyncConsentModal';
import { PrivacyModeService } from '../services/PrivacyModeService';
import { PriceService } from '../services/PriceService';
import ReceiveModal, { type AssetInfo } from '../components/ReceiveModal';
import KeyRotationModal from '../components/KeyRotationModal';
import Ron1nAssetCard from '../components/Ron1nAssetCard';
import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nScreenHeader from '../components/Ron1nScreenHeader';
import Ron1nEmptyState from '../components/Ron1nEmptyState';
import Ron1nStatusBadge from '../components/Ron1nStatusBadge';
import { ProtectBeforeSendService } from '../services/security/ProtectBeforeSendService';
import { IdentityRegistryService } from '../services/identity/IdentityRegistryService';
import { getAssetConfig } from '../config/assetCatalog';
import { getAssetVisual } from '../config/assetVisuals';
import {
  BalanceService,
  type BalanceSyncResult,
} from '../services/balances/BalanceService';
import { Ron1nBalance } from '../services/balances/types';
import {
  TransactionService,
  type TransactionSyncResult,
} from '../services/transactions/TransactionService';
import { ChainActivityCacheService } from '../services/transactions/ChainActivityCacheService';
import { Ron1nTransaction } from '../services/transactions/types';
import { ActivityService } from '../services/transactions/ActivityService';
import { VaultService } from '../services/VaultService';
import { WalletService } from '../services/WalletService';
import { ReceiveIdentityService } from '../services/identity/ReceiveIdentityService';
import type { SupportedChain } from '../services/crypto/types';
import { Ron1nColors } from '../theme/ron1nTheme';

type WalletAsset = {
  symbol: string;
  name: string;
  address: string;
};

type SyncIssue = {
  symbol: string;
  type: 'BALANCE' | 'HISTORY';
  message: string;
};

function shortAddress(address: string) {
  if (address.length <= 18) return address;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function WalletScreen() {
  const navigation = useNavigation<any>();

  const [privacyMode, setPrivacyMode] = useState(true);
  const [syncConsentVisible, setSyncConsentVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [balances, setBalances] = useState<Record<string, Ron1nBalance>>({});
  const [history, setHistory] = useState<Record<string, Ron1nTransaction[]>>({});
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncIssues, setSyncIssues] = useState<SyncIssue[]>([]);
  const [rotationNeeded, setRotationNeeded] = useState(false);
  const [rotationTarget, setRotationTarget] = useState<{ symbol: string; address: string } | null>(
    null
  );
  const [totalBalanceUsd, setTotalBalanceUsd] = useState<number | null>(null);
  const [unpricedAssetCount, setUnpricedAssetCount] = useState(0);

  const autoSyncedRef = useRef(false);
  const lastSyncAtRef = useRef(0);
  const AUTO_SYNC_MIN_INTERVAL_MS = 60_000;

  useEffect(() => {
    void (async () => {
      const enabled = await PrivacyModeService.isEnabled();
      setPrivacyMode(enabled);
      await loadWalletAssets();
    })();
  }, []);

  // Auto-refresh whenever Privacy Mode is off, like any other wallet app -
  // no manual button or per-sync prompt required once the user has opted
  // into public-chain sync via the Privacy Mode toggle itself.
  useEffect(() => {
    if (!privacyMode && assets.length > 0 && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      void performSync({ silent: true });
    }

    if (privacyMode) {
      autoSyncedRef.current = false;
    }
  }, [privacyMode, assets.length]);

  // Refresh again whenever the user returns to this tab, same as a normal
  // wallet re-checking balances when you open it. Also re-read Privacy Mode
  // in case it was changed from the Settings screen while this tab stayed
  // mounted in the background.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const enabled = await PrivacyModeService.isEnabled();
        setPrivacyMode(enabled);

        if (!enabled && assets.length > 0) {
          void performSync({ silent: true });
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assets.length])
  );

  // Recompute the portfolio total whenever synced balances change.
  useEffect(() => {
    const symbolsWithBalance = Object.keys(balances);

    if (symbolsWithBalance.length === 0) {
      setTotalBalanceUsd(null);
      setUnpricedAssetCount(0);
      return;
    }

    void (async () => {
      const prices = await PriceService.getUsdPrices(symbolsWithBalance);
      let total = 0;
      let unpriced = 0;

      for (const symbol of symbolsWithBalance) {
        const balance = balances[symbol];
        const confirmed = Number(balance?.confirmed);
        const price = prices[symbol.toUpperCase()];

        if (!Number.isFinite(confirmed) || confirmed <= 0) {
          continue;
        }

        if (typeof price === 'number') {
          total += confirmed * price;
        } else {
          unpriced += 1;
        }
      }

      setTotalBalanceUsd(total);
      setUnpricedAssetCount(unpriced);
    })();
  }, [balances]);

  const loadWalletAssets = async () => {
    try {
      setLoading(true);

      const hasVault = await VaultService.hasVault();

      if (!hasVault) {
        setAssets([]);
        return;
      }

      const [ethDefault, btc, ltc, sol, xrp, xlm, algo] = await Promise.all([
        WalletService.getEthereumWallet(),
        WalletService.getBitcoinWallet(),
        WalletService.getLitecoinWallet(),
        WalletService.getSolanaWallet(),
        WalletService.getXrpWallet(),
        WalletService.getStellarWallet(),
        WalletService.getAlgorandWallet(),
      ]);

      // ETH (and every EVM network sharing its address) can be rotated -
      // use whichever address is currently the active SPEND identity so a
      // rotated wallet doesn't keep showing balances/addresses for the
      // retired original address.
      const activeSpendIdentity = await IdentityRegistryService.findActive(
        'primary',
        'EVM',
        'SPEND'
      );
      const ethAddress = activeSpendIdentity?.address ?? ethDefault.address;

      const nativeAssets: WalletAsset[] = [
        { symbol: 'BTC', name: 'Bitcoin', address: btc.address },
        { symbol: 'LTC', name: 'Litecoin', address: ltc.address },
        { symbol: 'ETH', name: 'Ethereum', address: ethAddress },
        { symbol: 'SOL', name: 'Solana', address: sol.address },
        { symbol: 'XRP', name: 'XRP Ledger', address: xrp.address },
        { symbol: 'XLM', name: 'Stellar', address: xlm.address },
        { symbol: 'ALGO', name: 'Algorand', address: algo.address },
      ];

      // Keep every EVM/network symbol already defined by WalletService.
      // The UI resolves its logo/accent through assetVisuals rather than
      // replacing the project's existing crypto symbols.
      const evmAssets: WalletAsset[] = WalletService.getEvmNetworks(ethAddress)
        .filter((network) => network.symbol !== 'ETH')
        .map((network) => ({
          symbol: network.symbol,
          name: network.name,
          address: network.address,
        }));

      setAssets([...nativeAssets, ...evmAssets]);
      await checkEthRotationStatus();

      await ActivityService.addActivity(
        'RESTORE',
        'Wallet Assets Loaded',
        'Wallet assets restored from local vault'
      );
    } catch (error) {
      console.error('Failed to load wallet assets:', error);
      Alert.alert('Wallet Error', 'Unable to load wallet assets.');
    } finally {
      setLoading(false);
    }
  };

  const checkEthRotationStatus = async () => {
    try {
      const activeSpendIdentity = await IdentityRegistryService.findActive(
        'primary',
        'EVM',
        'SPEND'
      );

      const currentAddress = activeSpendIdentity
        ? activeSpendIdentity.address
        : (await WalletService.getEthereumWallet(0)).address;

      const protection = await ProtectBeforeSendService.assess('primary', 'EVM', currentAddress);
      const needsRotation =
        protection.status === 'REQUIRED' ||
        protection.status === 'UNREGISTERED' ||
        protection.status === 'BLOCKED';

      setRotationNeeded(needsRotation);
    } catch (error) {
      console.error('Failed to check ETH rotation status:', error);
      setRotationNeeded(false);
    }
  };

  const togglePrivacyMode = () => {
    if (privacyMode) {
      // Turning privacy mode OFF means the wallet will start auto-syncing
      // public-chain data. That's the one moment that deserves a heads-up.
      setSyncConsentVisible(true);
      return;
    }

    // Turning privacy mode back ON is always safe to do immediately.
    setPrivacyMode(true);
    void PrivacyModeService.setEnabled(true);
  };

  const confirmDisablePrivacyMode = () => {
    setSyncConsentVisible(false);
    setPrivacyMode(false);
    void PrivacyModeService.setEnabled(false);
  };

  const requestManualSync = () => {
    if (privacyMode) {
      Alert.alert(
        'Privacy Mode Active',
        'Disable Privacy Mode to sync public-chain balances and activity.'
      );
      return;
    }

    if (assets.length === 0) {
      Alert.alert('No Assets', 'Create or restore a vault before syncing.');
      return;
    }

    void performSync({ silent: false });
  };

  const performSync = async ({ silent }: { silent: boolean }) => {
    if (privacyMode || assets.length === 0 || isSyncing) {
      return;
    }

    // Silent (automatic) syncs are throttled so switching tabs quickly
    // doesn't hammer the free public block explorers. A manual SYNC button
    // press always bypasses this - that's an explicit user request.
    if (silent && Date.now() - lastSyncAtRef.current < AUTO_SYNC_MIN_INTERVAL_MS) {
      return;
    }

    lastSyncAtRef.current = Date.now();

    try {
      setIsSyncing(true);
      setSyncIssues([]);

      const requests = assets.map((asset) => ({
        symbol: asset.symbol,
        address: asset.address,
      }));

      const balanceResults =
        await BalanceService.getBalancesDetailed(requests);
      const historyResults =
        await TransactionService.getTransactionHistoryDetailed(requests);

      const nextBalances: Record<string, Ron1nBalance> = {};
      const nextHistory: Record<string, Ron1nTransaction[]> = {};
      const nextIssues: SyncIssue[] = [];
      const chainCacheRecords: Record<string, any> = {};

      Object.entries(balanceResults).forEach(
        ([symbol, result]: [string, BalanceSyncResult]) => {
          if (result.status === 'OK' && result.balance) {
            nextBalances[symbol] = result.balance;
          } else {
            nextIssues.push({
              symbol,
              type: 'BALANCE',
              message: result.error || 'Balance sync failed',
            });
          }
        }
      );

      Object.entries(historyResults).forEach(
        ([symbol, result]: [string, TransactionSyncResult]) => {
          if (result.status === 'OK') {
            nextHistory[symbol] = result.transactions;
            chainCacheRecords[symbol] = {
              symbol,
              transactions: result.transactions,
              syncedAt: new Date().toISOString(),
              status: 'OK',
            };
          } else {
            nextIssues.push({
              symbol,
              type: 'HISTORY',
              message: result.error || 'History sync failed',
            });
            chainCacheRecords[symbol] = {
              symbol,
              transactions: [],
              syncedAt: new Date().toISOString(),
              status: 'FAILED',
              error: result.error || 'History sync failed',
            };
          }
        }
      );

      setBalances(nextBalances);
      setHistory(nextHistory);
      setSyncIssues(nextIssues);
      setLastSyncedAt(new Date().toISOString());
      await ChainActivityCacheService.mergeCache(chainCacheRecords);

      const failedSymbols = new Set(nextIssues.map((issue) => issue.symbol));
      const failedCount = failedSymbols.size;
      const okCount = requests.length - failedCount;

      await ActivityService.addActivity(
        failedCount > 0 ? 'SECURITY' : 'SYNC',
        failedCount > 0 ? 'Sync Partially Completed' : 'Sync Complete',
        failedCount > 0
          ? `${okCount} assets synced. ${failedCount} assets had provider issues.`
          : 'Public-chain balance and activity sync completed'
      );

      if (!silent) {
        if (failedCount > 0) {
          Alert.alert(
            'Partial Sync Complete',
            `${okCount} assets synced. ${failedCount} assets had provider issues.`
          );
        } else {
          Alert.alert('Sync Complete', 'Balances and chain activity were refreshed.');
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);

      await ActivityService.addActivity(
        'SECURITY',
        'Sync Failed',
        'Unexpected sync failure during public-chain refresh'
      );

      if (!silent) {
        Alert.alert('Sync Error', 'Failed to sync balances or chain activity.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const openReceive = async (asset: WalletAsset) => {
    try {
      const symbol = asset.symbol.toUpperCase();
      const chain: SupportedChain =
        symbol === 'BTC'
          ? 'BITCOIN'
          : symbol === 'LTC'
            ? 'LITECOIN'
            : symbol === 'SOL'
              ? 'SOLANA'
              : symbol === 'XRP'
                ? 'XRP'
                : symbol === 'XLM'
                  ? 'STELLAR'
                  : symbol === 'ALGO'
                    ? 'ALGORAND'
                    : 'EVM';

      // EVM addresses can be rotated (sweep + retire), which activates a new
      // SPEND identity instead of an INGRESS one. Check for that first so a
      // rotated wallet doesn't keep showing the retired original address.
      const activeSpendIdentity =
        chain === 'EVM'
          ? await IdentityRegistryService.findActive('primary', 'EVM', 'SPEND')
          : null;

      const receiveAddress = activeSpendIdentity
        ? activeSpendIdentity.address
        : (
            await ReceiveIdentityService.getOrCreateIngressIdentity(
              'primary',
              chain,
              0
            )
          ).address.address;

      await ActivityService.addActivity(
        'RECEIVE_VIEW',
        `Viewed ${asset.symbol} Receive`,
        'Ingress receive identity opened'
      );

      setSelectedAsset({
        symbol: asset.symbol,
        name: asset.name,
        address: receiveAddress,
      });

      setReceiveModalVisible(true);
    } catch (error) {
      console.error('Failed to prepare receive identity:', error);
      Alert.alert(
        'Receive Unavailable',
        'Unable to prepare the receive identity. No funds were moved.'
      );
    }
  };

  const openRotation = async (asset: WalletAsset) => {
    const symbol = asset.symbol.toUpperCase();

    if (symbol !== 'ETH') {
      setRotationTarget({ symbol: asset.symbol, address: asset.address });
      return;
    }

    const activeSpendIdentity = await IdentityRegistryService.findActive(
      'primary',
      'EVM',
      'SPEND'
    );

    const currentAddress = activeSpendIdentity
      ? activeSpendIdentity.address
      : (await WalletService.getEthereumWallet(0)).address;

    setRotationTarget({ symbol: asset.symbol, address: currentAddress });
  };

  const renderSyncStatus = () => {
    if (!lastSyncedAt && syncIssues.length === 0) return null;

    return (
      <Ron1nCard>
        <Text style={styles.label}>SYNC STATUS</Text>

        {lastSyncedAt ? (
          <Text style={styles.statusBody}>
            Last synced: {new Date(lastSyncedAt).toLocaleString()}
          </Text>
        ) : null}

        {syncIssues.length === 0 ? (
          <View style={styles.syncGoodRow}>
            <Ron1nStatusBadge tone="success" label="ALL PROVIDERS OK" />
          </View>
        ) : (
          <View style={styles.issueList}>
            {syncIssues.slice(0, 6).map((issue, index) => (
              <View key={`${issue.symbol}-${issue.type}-${index}`} style={styles.issueRow}>
                <View style={styles.issueHeader}>
                  <Text style={styles.issueSymbol}>{issue.symbol}</Text>
                  <Ron1nStatusBadge tone="danger" label={issue.type} />
                </View>
                <Text style={styles.issueText}>{issue.message}</Text>
              </View>
            ))}
          </View>
        )}
      </Ron1nCard>
    );
  };

  if (loading) {
    return (
      <Ron1nScreen>
        <SafeAreaView style={styles.loading}>
          <Image
            source={require('../../assets/ron1n.png')}
            style={styles.loadingLogo}
          />
          <ActivityIndicator size="small" color={Ron1nColors.green} />
          <Text style={styles.loadingText}>OPENING SHOGUN VAULT</Text>
        </SafeAreaView>
      </Ron1nScreen>
    );
  }

  return (
    <Ron1nScreen>
      <StatusBar barStyle="light-content" />

      <SafeAreaView style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Ron1nScreenHeader
            title="SHOGUN WALLET"
            subtitle="RON1N SECURITY LAYER"
            accent="gold"
            rightActions={
              <>
                <TouchableOpacity
                  onPress={() => void loadWalletAssets()}
                  style={styles.headerButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={20} color={Ron1nColors.white} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('Settings')}
                  style={styles.headerButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="settings-outline" size={20} color={Ron1nColors.white} />
                </TouchableOpacity>
              </>
            }
          />

          <LinearGradient
            colors={[`${Ron1nColors.purple}30`, `${Ron1nColors.purple}08`, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroKicker}>TOTAL BALANCE</Text>
            <Text style={styles.heroBalance}>
              {totalBalanceUsd === null
                ? '— — —'
                : `$${totalBalanceUsd.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </Text>
            <Text style={styles.heroBody}>
              {totalBalanceUsd === null
                ? privacyMode
                  ? 'Turn off Privacy Mode to see your total balance.'
                  : 'Syncing your balances…'
                : unpricedAssetCount > 0
                  ? `Across ${assets.length} assets — ${unpricedAssetCount} not priced yet`
                  : `Across ${assets.length} assets, held locally — self-custody`}
            </Text>

            <View style={styles.heroMetrics}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{assets.length}</Text>
                <Text style={styles.metricLabel}>ASSETS HELD</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metric}>
                <Text style={[styles.metricValue, { color: Ron1nColors.green }]}>
                  {privacyMode ? 'ON' : 'OFF'}
                </Text>
                <Text style={styles.metricLabel}>PRIVACY MODE</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionCard, styles.actionPrimary]}
              onPress={() => navigation.navigate('Send')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconBadge, { backgroundColor: `${Ron1nColors.white}18` }]}>
                <Ionicons name="arrow-up-circle-outline" size={22} color={Ron1nColors.white} />
              </View>
              <Text style={styles.actionTitle}>SEND</Text>
              <Text style={styles.actionCaption}>Review, then approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => assets[0] && void openReceive(assets[0])}
              disabled={assets.length === 0}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconBadge, { backgroundColor: `${Ron1nColors.green}18` }]}>
                <Ionicons name="qr-code-outline" size={22} color={Ron1nColors.green} />
              </View>
              <Text style={[styles.actionTitle, { color: Ron1nColors.green }]}>RECEIVE</Text>
              <Text style={styles.actionCaption}>Share your address</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Security')}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconBadge, { backgroundColor: `${Ron1nColors.purple}18` }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color={Ron1nColors.purple} />
              </View>
              <Text style={[styles.actionTitle, { color: Ron1nColors.purple }]}>
                SECURITY
              </Text>
              <Text style={styles.actionCaption}>Checks & protection</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modeRow}>
            <View style={styles.modeText}>
              <View
                style={[
                  styles.modeDot,
                  { backgroundColor: privacyMode ? Ron1nColors.green : Ron1nColors.gold },
                ]}
              />
              <View>
                <Text style={styles.modeTitle}>
                  {privacyMode ? 'PRIVACY MODE ON' : 'LIVE SYNC AVAILABLE'}
                </Text>
                <Text style={styles.modeCaption}>
                  {lastSyncedAt
                    ? `Last updated ${new Date(lastSyncedAt).toLocaleTimeString()}`
                    : privacyMode
                      ? 'Your balances stay local until you turn this off.'
                      : 'Syncing automatically in the background.'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={togglePrivacyMode}
              style={styles.modeToggle}
              activeOpacity={0.85}
            >
              <Ionicons
                name={privacyMode ? 'eye-off-outline' : 'eye-outline'}
                size={19}
                color={privacyMode ? Ron1nColors.green : Ron1nColors.gold}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>YOUR CRYPTO</Text>
              <Text style={styles.sectionCaption}>
                Balances and addresses across every supported chain.
              </Text>
            </View>

            <TouchableOpacity
              onPress={requestManualSync}
              disabled={privacyMode || isSyncing || assets.length === 0}
              style={[
                styles.syncButton,
                (privacyMode || isSyncing || assets.length === 0) &&
                  styles.syncButtonDisabled,
              ]}
              activeOpacity={0.85}
            >
              <Ionicons
                name="sync-outline"
                size={15}
                color={privacyMode || isSyncing ? Ron1nColors.gray : Ron1nColors.green}
              />
              <Text
                style={[
                  styles.syncButtonText,
                  (privacyMode || isSyncing || assets.length === 0) &&
                    styles.syncButtonTextDisabled,
                ]}
              >
                {isSyncing ? 'SYNCING' : 'SYNC'}
              </Text>
            </TouchableOpacity>
          </View>

          {assets.length === 0 ? (
            <Ron1nCard>
              <Ron1nEmptyState
                icon="wallet-outline"
                title="NO WALLET YET"
                message="Set up or restore your Shogun wallet to see your balances and addresses here."
              />
            </Ron1nCard>
          ) : (
            <View style={styles.assetList}>
              {assets.map((item) => {
                // The existing visual registry controls the symbol logo/accent.
                // This keeps user-added crypto symbols intact.
                const visual = getAssetVisual(item.symbol);
                const config = getAssetConfig(item.symbol);
                const balance = balances[item.symbol];
                const transactions = history[item.symbol];

                return (
                  <Ron1nAssetCard
                    key={item.symbol}
                    symbol={item.symbol}
                    name={item.name}
                    address={item.address}
                    accent={visual.accent}
                    balance={balance?.confirmed}
                    balanceStatus={balance?.status}
                    transactionCount={transactions?.length}
                    securityLabel={config?.securityLabel}
                    onPress={() => void openReceive(item)}
                    onRotatePress={() => void openRotation(item)}
                    needsRotation={item.symbol.toUpperCase() === 'ETH' && rotationNeeded}
                  />
                );
              })}
            </View>
          )}

          {renderSyncStatus()}

          <View style={styles.securityStrip}>
            <Ionicons name="lock-closed-outline" size={18} color={Ron1nColors.gold} />
            <View style={styles.securityStripText}>
              <Text style={styles.securityStripTitle}>WHY SENDING FEELS SLOWER</Text>
              <Text style={styles.securityStripBody}>
                Receiving is instant and risk-free. Sending takes a few extra steps
                on purpose — reviewed, approved with biometrics, signed, and
                confirmed on-chain before anything leaves your wallet.
              </Text>
            </View>
          </View>
        </ScrollView>

        <ManualSyncConsentModal
          visible={syncConsentVisible}
          onCancel={() => setSyncConsentVisible(false)}
          onConfirm={confirmDisablePrivacyMode}
        />

        <ReceiveModal
          visible={receiveModalVisible}
          onClose={() => setReceiveModalVisible(false)}
          asset={selectedAsset}
          onRotatePress={() => {
            if (selectedAsset) {
              setRotationTarget({ symbol: selectedAsset.symbol, address: selectedAsset.address });
            }
          }}
        />

        <KeyRotationModal
          visible={rotationTarget !== null}
          symbol={rotationTarget?.symbol ?? 'ETH'}
          currentAddress={rotationTarget?.address || 'Address unavailable'}
          onClose={() => {
            setRotationTarget(null);
            void checkEthRotationStatus();
          }}
          onSelectFreshKey={() => {
            setRotationTarget(null);
            void checkEthRotationStatus();
          }}
        />
      </SafeAreaView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  loading: {
    flex: 1,
    minHeight: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    resizeMode: 'contain',
    marginBottom: 12,
  },
  loadingText: {
    color: Ron1nColors.green,
    marginTop: 12,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroCard: {
    borderRadius: 27,
    padding: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${Ron1nColors.purple}55`,
    shadowColor: Ron1nColors.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  heroKicker: {
    color: Ron1nColors.gray,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  heroBalance: {
    color: Ron1nColors.white,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  heroBody: {
    color: '#9B9BA8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    maxWidth: 310,
  },
  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  metric: {
    flex: 1,
  },
  metricValue: {
    color: Ron1nColors.white,
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: Ron1nColors.gray,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 3,
  },
  metricDivider: {
    width: 1,
    height: 35,
    backgroundColor: '#2C2C35',
    marginHorizontal: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 102,
    borderRadius: 20,
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  actionPrimary: {
    backgroundColor: `${Ron1nColors.purple}18`,
    borderColor: `${Ron1nColors.purple}55`,
  },
  actionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    color: Ron1nColors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 7,
  },
  actionCaption: {
    color: '#6F6F7A',
    fontSize: 7,
    textAlign: 'center',
    marginTop: 4,
  },
  modeRow: {
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 13,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeText: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    marginRight: 10,
  },
  modeTitle: {
    color: Ron1nColors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  modeCaption: {
    color: '#747480',
    fontSize: 8,
    marginTop: 3,
  },
  modeToggle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: Ron1nColors.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sectionCaption: {
    color: '#70707B',
    fontSize: 8,
    marginTop: 3,
  },
  syncButton: {
    minWidth: 74,
    height: 34,
    borderRadius: 11,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: `${Ron1nColors.green}10`,
    borderWidth: 1,
    borderColor: `${Ron1nColors.green}44`,
  },
  syncButtonDisabled: {
    backgroundColor: '#111116',
    borderColor: '#292930',
  },
  syncButtonText: {
    color: Ron1nColors.green,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  syncButtonTextDisabled: {
    color: Ron1nColors.gray,
  },
  assetList: {
    paddingBottom: 8,
  },
  label: {
    color: Ron1nColors.gray,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 8,
  },
  statusBody: {
    color: '#AAAAAA',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 3,
  },
  syncGoodRow: {
    marginTop: 8,
  },
  issueList: {
    gap: 7,
    marginTop: 9,
  },
  issueRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF777744',
    backgroundColor: '#FF4D4D12',
    padding: 9,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  issueSymbol: {
    color: '#FF9999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  issueText: {
    color: '#DDDDDD',
    fontSize: 10,
    lineHeight: 15,
  },
  emptyTitle: {
    color: Ron1nColors.gold,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  emptyText: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  securityStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    padding: 13,
    marginTop: 8,
    backgroundColor: '#FFD7000A',
    borderWidth: 1,
    borderColor: '#FFD7002A',
  },
  securityStripText: {
    flex: 1,
    marginLeft: 10,
  },
  securityStripTitle: {
    color: Ron1nColors.gold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  securityStripBody: {
    color: '#777784',
    fontSize: 8,
    lineHeight: 13,
    marginTop: 3,
  },
});

