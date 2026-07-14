import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';

import ReceiveModal, { type AssetInfo } from '../components/ReceiveModal';
import Ron1nAssetCard from '../components/Ron1nAssetCard';
import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreen from '../components/Ron1nScreen';
import { getAssetConfig } from '../config/assetCatalog';
import { getAssetVisual } from '../config/assetVisuals';
import { BalanceService } from '../services/balances/BalanceService';
import { Ron1nBalance } from '../services/balances/types';
import { TransactionService } from '../services/transactions/TransactionService';
import { Ron1nTransaction } from '../services/transactions/types';
import { VaultService } from '../services/VaultService';
import { WalletService } from '../services/WalletService';
import { ActivityService } from '../services/transactions/ActivityService';
import { Ron1nColors } from '../theme/ron1nTheme';

type WalletAsset = {
  symbol: string;
  name: string;
  address: string;
};

export default function WalletScreen() {
  const [privacyMode, setPrivacyMode] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [balances, setBalances] = useState<Record<string, Ron1nBalance>>({});
  const [history, setHistory] = useState<Record<string, Ron1nTransaction[]>>({});
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const logActivity = async (_type: string, _title: string, _description: string) => {
    return Promise.resolve();
  };

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

      const requests = assets.map((asset) => ({
        symbol: asset.symbol,
        address: asset.address,
      }));

      const balanceData = await BalanceService.getBalances(requests);
      const historyData = await TransactionService.getTransactionHistory(requests);

      setBalances(balanceData);
      setHistory(historyData);

      await ActivityService.addActivity(
        'SECURITY',
        'Manual Sync Complete',
        'User-approved public-chain balance and activity sync completed'
      );

      Alert.alert('Sync Complete', 'Balances and chain activity were refreshed.');
    } catch (error) {
      console.error('Manual sync failed:', error);
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
            style={[styles.actionButton, privacyMode ? styles.syncButton : styles.privateButton]}
          >
            <Text style={styles.actionButtonText}>
              {privacyMode ? 'ENABLE MANUAL SYNC' : 'ENTER PRIVATE MODE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleManualSync}
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

        {assets.length === 0 ? (
          <Ron1nCard>
            <Text style={styles.emptyTitle}>NO VAULT FOUND</Text>
            <Text style={styles.emptyText}>
              Create or restore a vault before syncing assets.
            </Text>
          </Ron1nCard>
        ) : (
          <FlatList
            data={assets}
            keyExtractor={(item) => item.symbol}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const visual = getAssetVisual(item.symbol);
              const config = getAssetConfig(item.symbol);
              const balance = balances[item.symbol];
              const transactions = history[item.symbol];

              return (
                <Ron1nAssetCard
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
            }}
          />
        )}

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
  listContent: {
    paddingBottom: 120,
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
});