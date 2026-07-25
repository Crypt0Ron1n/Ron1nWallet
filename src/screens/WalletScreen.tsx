import React, { useEffect, useState } from 'react';
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
import * as LocalAuthentication from 'expo-local-authentication';

import ManualSyncConsentModal from '../components/ManualSyncConsentModal';
import ReceiveModal, { type AssetInfo } from '../components/ReceiveModal';
import Ron1nAssetCard from '../components/Ron1nAssetCard';
import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreen from '../components/Ron1nScreen';
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

export default function WalletScreen() {
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

  useEffect(() => {
    loadWalletAssets();
  }, []);

  const loadWalletAssets = async () => {
    try {
      setLoading(true);

      const mnemonic = await VaultService.getMnemonic();

      if (!mnemonic) {
        setAssets([]);
        return;
      }

      const eth = WalletService.getEthereumWallet(mnemonic);
      const btc = WalletService.getBitcoinWallet(mnemonic);
      const ltc = WalletService.getLitecoinWallet(mnemonic);
      const sol = WalletService.getSolanaWallet(mnemonic);
      const xrp = WalletService.getXrpWallet(mnemonic);
      const xlm = WalletService.getStellarWallet(mnemonic);
      const algo = WalletService.getAlgorandWallet(mnemonic);

      const nativeAssets: WalletAsset[] = [
        { symbol: 'BTC', name: 'Bitcoin', address: btc.address },
        { symbol: 'LTC', name: 'Litecoin', address: ltc.address },
        { symbol: 'ETH', name: 'Ethereum', address: eth.address },
        { symbol: 'SOL', name: 'Solana', address: sol.address },
        { symbol: 'XRP', name: 'XRP Ledger', address: xrp.address },
        { symbol: 'XLM', name: 'Stellar', address: xlm.address },
        { symbol: 'ALGO', name: 'Algorand', address: algo.address },
      ];

      const evmAssets: WalletAsset[] = WalletService.getEvmNetworks(eth.address)
        .filter((network) => network.symbol !== 'ETH')
        .map((network) => ({
          symbol: network.symbol,
          name: network.name,
          address: network.address,
        }));

      setAssets([...nativeAssets, ...evmAssets]);

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

  const requestManualSync = () => {
    if (privacyMode) {
      Alert.alert(
        'Privacy Mode Active',
        'Disable Privacy Mode before syncing public-chain balances or activity.'
      );
      return;
    }

    if (assets.length === 0) {
      Alert.alert('No Assets', 'Create or restore a vault before syncing.');
      return;
    }

    setSyncConsentVisible(true);
  };

  const handleManualSync = async () => {
    if (privacyMode) {
      Alert.alert(
        'Privacy Mode Active',
        'Disable Privacy Mode before syncing public-chain balances or activity.'
      );
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();

    if (!hasHardware) {
      Alert.alert('Error', 'Biometric support is not available on this device.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to Sync Public Chain Data',
      fallbackLabel: 'Use device passcode',
    });

    if (!result.success) {
      Alert.alert('Sync Blocked', 'Authentication failed.');
      return;
    }

    try {
      setIsSyncing(true);
      setSyncIssues([]);

      const requests = assets.map((asset) => ({
        symbol: asset.symbol,
        address: asset.address,
      }));

      const balanceResults = await BalanceService.getBalancesDetailed(requests);
      const historyResults = await TransactionService.getTransactionHistoryDetailed(requests);

      const nextBalances: Record<string, Ron1nBalance> = {};
      const nextHistory: Record<string, Ron1nTransaction[]> = {};
      const nextIssues: SyncIssue[] = [];
      const chainCacheRecords: Record<string, any> = {};

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

      Object.entries(historyResults).forEach(
        ([symbol, result]: [string, TransactionSyncResult]) => {
          if (result.status === 'OK') {
            nextHistory[symbol] = result.transactions;
          } else {
            nextIssues.push({
              symbol,
              type: 'HISTORY',
              message: result.error || 'History sync failed',
            });
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
        failedCount > 0 ? 'Manual Sync Partially Completed' : 'Manual Sync Complete',
        failedCount > 0
          ? `${okCount} assets synced. ${failedCount} assets had provider issues.`
          : 'User-approved public-chain balance and activity sync completed'
      );

      if (failedCount > 0) {
        Alert.alert(
          'Partial Sync Complete',
          `${okCount} assets synced. ${failedCount} assets had provider issues.`
        );
      } else {
        Alert.alert('Sync Complete', 'Balances and chain activity were refreshed.');
      }
    } catch (error) {
      console.error('Manual sync failed:', error);

      await ActivityService.addActivity(
        'SECURITY',
        'Manual Sync Failed',
        'Unexpected sync failure during user-approved public-chain refresh'
      );

      Alert.alert('Sync Error', 'Failed to sync balances or chain activity.');
    } finally {
      setIsSyncing(false);
    }
  };

  const openReceive = async (asset: WalletAsset) => {
    await ActivityService.addActivity(
      'RECEIVE_VIEW',
      `Viewed ${asset.symbol} Receive`,
      'Receive QR opened'
    );

    setSelectedAsset({
      symbol: asset.symbol,
      name: asset.name,
      address: asset.address,
    });

    setReceiveModalVisible(true);
  };

  const renderSyncStatus = () => {
    if (!lastSyncedAt && syncIssues.length === 0) {
      return null;
    }

    return (
      <Ron1nCard>
        <Text style={styles.label}>SYNC STATUS</Text>

        {lastSyncedAt ? (
          <Text style={styles.statusBody}>
            Last synced: {new Date(lastSyncedAt).toLocaleString()}
          </Text>
        ) : null}

        {syncIssues.length === 0 ? (
          <Text style={styles.syncGood}>ALL PROVIDERS OK</Text>
        ) : (
          <View style={styles.issueList}>
            {syncIssues.slice(0, 8).map((issue, index) => (
              <View key={`${issue.symbol}-${issue.type}-${index}`} style={styles.issueRow}>
                <Text style={styles.issueSymbol}>{issue.symbol}</Text>
                <Text style={styles.issueText}>
                  {issue.type}: {issue.message}
                </Text>
              </View>
            ))}

            {syncIssues.length > 8 ? (
              <Text style={styles.moreIssues}>
                +{syncIssues.length - 8} more provider issues
              </Text>
            ) : null}
          </View>
        )}
      </Ron1nCard>
    );
  };

  if (loading) {
    return (
      <Ron1nScreen>
        <SafeAreaView style={styles.loading}>
          <ActivityIndicator size="large" color={Ron1nColors.green} />
          <Text style={styles.loadingText}>LOADING VAULT</Text>
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
          <View style={styles.header}>
            <Image source={require('../../assets/rs-graffiti.png')} style={styles.logo} />

            <Text style={styles.brand}>SHOGUN WALLET</Text>
            <Text style={styles.subtitle}>RON1N SECURITY LAYER</Text>
          </View>

          <Ron1nCard>
            <Text style={styles.label}>VAULT STATUS</Text>

            <Text
              style={[
                styles.statusText,
                { color: privacyMode ? Ron1nColors.green : Ron1nColors.gold },
              ]}
            >
              {privacyMode ? 'PRIVACY MODE ACTIVE' : 'MANUAL SYNC ENABLED'}
            </Text>

            <Text style={styles.statusBody}>
              {privacyMode
                ? 'Public-chain data is not fetched automatically.'
                : 'Manual sync can fetch balances and public-chain activity.'}
            </Text>
          </Ron1nCard>

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => setPrivacyMode(!privacyMode)}
              style={[
                styles.actionButton,
                privacyMode ? styles.syncButton : styles.privateButton,
              ]}
            >
              <Text style={styles.actionButtonText}>
                {privacyMode ? 'ENABLE MANUAL SYNC' : 'ENTER PRIVATE MODE'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={requestManualSync}
              disabled={privacyMode || isSyncing || assets.length === 0}
              style={[
                styles.actionButton,
                privacyMode || isSyncing || assets.length === 0
                  ? styles.disabledButton
                  : styles.syncButton,
              ]}
            >
              <Text style={styles.actionButtonText}>
                {isSyncing ? 'SYNCING...' : 'SYNC'}
              </Text>
            </TouchableOpacity>
          </View>

          {renderSyncStatus()}

          {assets.length === 0 ? (
            <Ron1nCard>
              <Text style={styles.emptyTitle}>NO VAULT FOUND</Text>
              <Text style={styles.emptyText}>
                Create or restore a vault before syncing assets.
              </Text>
            </Ron1nCard>
          ) : (
            <View style={styles.assetList}>
              {assets.map((item) => {
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
                    onPress={() => openReceive(item)}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>

        <ManualSyncConsentModal
          visible={syncConsentVisible}
          onCancel={() => setSyncConsentVisible(false)}
          onConfirm={() => {
            setSyncConsentVisible(false);
            handleManualSync();
          }}
        />

        <ReceiveModal
          visible={receiveModalVisible}
          onClose={() => setReceiveModalVisible(false)}
          asset={selectedAsset}
        />
      </SafeAreaView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Ron1nColors.green,
    marginTop: 14,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'KatakanaStyle',
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  logo: {
    width: 118,
    height: 118,
    resizeMode: 'contain',
    marginBottom: 8,
    borderRadius: 26,
  },
  brand: {
    color: Ron1nColors.gold,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'KatakanaStyle',
  },
  subtitle: {
    color: Ron1nColors.green,
    fontSize: 10,
    letterSpacing: 3,
    marginTop: 7,
    fontFamily: 'KatakanaStyle',
  },
  label: {
    color: Ron1nColors.gray,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: 'KatakanaStyle',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'KatakanaStyle',
  },
  statusBody: {
    color: '#AAAAAA',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
  },
  syncButton: {
    backgroundColor: '#00FF4115',
    borderColor: '#00FF4166',
  },
  privateButton: {
    backgroundColor: '#FFD70015',
    borderColor: '#FFD70066',
  },
  disabledButton: {
    backgroundColor: '#111',
    borderColor: '#333',
  },
  actionButtonText: {
    color: Ron1nColors.white,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  assetList: {
    paddingBottom: 12,
  },
  emptyTitle: {
    color: Ron1nColors.gold,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
    marginBottom: 10,
  },
  emptyText: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
  },
  syncGood: {
    color: Ron1nColors.green,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 10,
  },
  issueList: {
    marginTop: 12,
    gap: 8,
  },
  issueRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF777744',
    backgroundColor: '#FF4D4D12',
    padding: 10,
  },
  issueSymbol: {
    color: '#FF9999',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  issueText: {
    color: '#DDDDDD',
    fontSize: 11,
    lineHeight: 16,
  },
  moreIssues: {
    color: '#AAAAAA',
    fontSize: 11,
    marginTop: 4,
  },
});