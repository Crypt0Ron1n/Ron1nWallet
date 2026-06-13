import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { useFonts, ZenDots_400Regular } from '@expo-google-fonts/zen-dots';
import * as ScreenCapture from 'expo-screen-capture';
import * as Clipboard from 'expo-clipboard';

import { getAssetConfig } from '../config/assetCatalog';
import { getAssetVisual } from '../config/assetVisuals';
import ReceiveModal, { type AssetInfo } from '../components/ReceiveModal';
import Ron1nAssetCard from '../components/Ron1nAssetCard';
import Ron1nCard from '../components/Ron1nCard';
import Ron1nPressable from '../components/Ron1nPressable';
import Ron1nScreen from '../components/Ron1nScreen';
import { ActivityService } from '../services/ActivityService';
import { BalanceService } from '../services/balances/BalanceService';
import { Ron1nBalance } from '../services/balances/types';
import { TransactionService } from '../services/transactions/TransactionService';
import { Ron1nTransaction } from '../services/transactions/types';
import { VaultService } from '../services/VaultService';
import { WalletService } from '../services/WalletService';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function WalletScreen() {
  const [synID, setSynID] = useState<string | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [phraseVisible, setPhraseVisible] = useState(false);

  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);

  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [btcAddress, setBtcAddress] = useState<string | null>(null);
  const [ltcAddress, setLtcAddress] = useState<string | null>(null);
  const [solAddress, setSolAddress] = useState<string | null>(null);
  const [xrpAddress, setXrpAddress] = useState<string | null>(null);
  const [xlmAddress, setXlmAddress] = useState<string | null>(null);
  const [algoAddress, setAlgoAddress] = useState<string | null>(null);

  const [balances, setBalances] = useState<Record<string, Ron1nBalance>>({});
  const [history, setHistory] = useState<Record<string, Ron1nTransaction[]>>({});
  const [syncing, setSyncing] = useState(false);

  const [fontsLoaded] = useFonts({
    KatakanaStyle: ZenDots_400Regular,
  });

  useEffect(() => {
    const secureApp = async () => {
      try {
        const id = await VaultService.getIdentity();
        if (id) setSynID(id);

        const mnemonic = await VaultService.getMnemonic();

        if (mnemonic) {
          hydrateWallet(mnemonic);

          await ActivityService.addActivity(
            'RESTORE',
            'Wallet Restored',
            'Vault loaded from SecureStore'
          );
        }
      } catch (e) {
        console.error('Vault boot error:', e);
      }
    };

    secureApp();
  }, []);

  useEffect(() => {
    let mounted = true;

    const timeoutId = setTimeout(() => {
      const lockScreenCapture = async () => {
        try {
          if (!mounted) return;
          await ScreenCapture.preventScreenCaptureAsync();
        } catch (e) {
          if (__DEV__) console.warn('Screen capture protection not ready yet:', e);
        }
      };

      lockScreenCapture();
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const hydrateWallet = (mnemonic: string) => {
    const eth = WalletService.getEthereumWallet(mnemonic);
    const btc = WalletService.getBitcoinWallet(mnemonic);
    const ltc = WalletService.getLitecoinWallet(mnemonic);
    const sol = WalletService.getSolanaWallet(mnemonic);
    const xrp = WalletService.getXrpWallet(mnemonic);
    const xlm = WalletService.getStellarWallet(mnemonic);
    const algo = WalletService.getAlgorandWallet(mnemonic);

    setEthAddress(eth.address);
    setBtcAddress(btc.address);
    setLtcAddress(ltc.address);
    setSolAddress(sol.address);
    setXrpAddress(xrp.address);
    setXlmAddress(xlm.address);
    setAlgoAddress(algo.address);
  };

  const baseAssets = [
    { symbol: 'BTC', name: 'Bitcoin', address: btcAddress },
    { symbol: 'LTC', name: 'Litecoin', address: ltcAddress },
    { symbol: 'ETH', name: 'Ethereum', address: ethAddress },
    { symbol: 'SOL', name: 'Solana', address: solAddress },
    { symbol: 'XRP', name: 'XRP Ledger', address: xrpAddress },
    { symbol: 'XLM', name: 'Stellar', address: xlmAddress },
    { symbol: 'ALGO', name: 'Algorand', address: algoAddress },
  ].filter(
    (asset): asset is AssetInfo =>
      typeof asset.address === 'string' && asset.address.length > 0
  );

  const evmAssets =
    ethAddress !== null
      ? WalletService.getEvmNetworks(ethAddress).filter((asset) => asset.symbol !== 'ETH')
      : [];

  const allAssets: AssetInfo[] = [...baseAssets, ...evmAssets];

  const syncLiveData = async () => {
    if (allAssets.length === 0) return;

    try {
      setSyncing(true);

      const requests = allAssets.map((asset) => ({
        symbol: asset.symbol,
        address: asset.address,
      }));

      const balanceData = await BalanceService.getBalances(requests);
      const historyData = await TransactionService.getTransactionHistory(requests);

      setBalances(balanceData);
      setHistory(historyData);

      await ActivityService.addActivity(
        'SECURITY',
        'Provider Sync',
        'Balances and transaction history refreshed'
      );
    } catch (error) {
      console.error('Live data sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const copySynID = async () => {
    if (!synID) return;

    await ActivityService.addActivity(
      'COPY',
      'Copied Syn-ID',
      'Syndicate ID copied to clipboard'
    );

    await Clipboard.setStringAsync(synID);
  };

  const forgeIdentity = async () => {
    try {
      const mnemonic = WalletService.createMnemonic();

      await VaultService.saveMnemonic(mnemonic);

      hydrateWallet(mnemonic);

      const mnemonicArray = mnemonic.split(' ');
      setWords(mnemonicArray);
      setPhraseVisible(false);

      const seed = mnemonicArray.join(' ');
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        seed
      );

      const newID = `syn-${hash.substring(0, 8).toUpperCase()}`;

      await VaultService.saveIdentity(newID);

      await ActivityService.addActivity(
        'FORGE',
        'Wallet Forged',
        'New Syn-ID and wallet vault created'
      );

      setSynID(newID);
      setShowMnemonic(true);
    } catch (error) {
      console.error('Forge Save Failed:', error);
    }
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Ron1nColors.green} />
      </SafeAreaView>
    );
  }

  return (
    <Ron1nScreen>
      <StatusBar barStyle="light-content" />

      <SafeAreaView>
        <View style={styles.hero}>
          <Image source={require('../../assets/rs-graffiti.png')} style={styles.logoGraffiti} />
          <Text style={styles.brand}>SHOGUN WALLET</Text>
          <Text style={styles.subtitle}>Powered by Ron1n Security Layer</Text>
        </View>

        <Ron1nCard>
          <Text style={styles.label}>SYNDICATE ID</Text>
          <Text style={styles.idText}>{synID || '---- ---- ----'}</Text>

          <View style={styles.statusPill}>
            <Text style={styles.statusText}>
              {synID ? 'VAULT SECURED' : 'PENDING FORGE'}
            </Text>
          </View>

          {synID && (
            <View style={styles.cardActions}>
              <Ron1nPressable style={styles.smallButton} onPress={copySynID}>
                <Text style={styles.smallButtonText}>COPY ID</Text>
              </Ron1nPressable>

              <Ron1nPressable
                style={styles.smallButtonBlue}
                onPress={async () => {
                  await ActivityService.addActivity(
                    'RECEIVE_VIEW',
                    'Viewed Syn-ID Receive',
                    'Syndicate ID receive QR opened'
                  );

                  setSelectedAsset({
                    symbol: 'SYN-ID',
                    name: 'Syndicate Identity',
                    address: synID,
                  });
                  setReceiveModalVisible(true);
                }}
              >
                <Text style={styles.smallButtonTextBlue}>RECEIVE</Text>
              </Ron1nPressable>
            </View>
          )}
        </Ron1nCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SECURED ASSETS</Text>

          <TouchableOpacity onPress={syncLiveData} disabled={syncing}>
            <Text style={styles.syncText}>{syncing ? 'SYNCING...' : 'SYNC'}</Text>
          </TouchableOpacity>
        </View>

        {allAssets.map((asset) => {
          const visual = getAssetVisual(asset.symbol);
          const config = getAssetConfig(asset.symbol);
          const balance = balances[asset.symbol];
          const txs = history[asset.symbol];

          return (
            <Ron1nAssetCard
              key={asset.symbol}
              symbol={asset.symbol}
              name={asset.name}
              address={asset.address}
              accent={visual.accent}
              balance={balance?.confirmed}
              balanceStatus={balance?.status}
              transactionCount={txs?.length}
              securityLabel={config?.securityLabel}
              onPress={async () => {
                await ActivityService.addActivity(
                  'RECEIVE_VIEW',
                  `Viewed ${asset.symbol} Receive`,
                  'Receive QR opened'
                );

                setSelectedAsset(asset);
                setReceiveModalVisible(true);
              }}
            />
          );
        })}

        <Ron1nPressable style={styles.primaryButton} onPress={forgeIdentity}>
          <Text style={styles.primaryButtonText}>
            {synID ? 'RE-FORGE VAULT' : 'FORGE ID'}
          </Text>
        </Ron1nPressable>
      </SafeAreaView>

      <Modal visible={showMnemonic} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalTitle}>RECOVERY PHRASE</Text>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerTitle}>SECURITY PROTOCOL</Text>
            <Text style={styles.disclaimerText}>
              PHYSICAL BACKUP ONLY. FOR QUANTUM SAFETY. ロニン
            </Text>
          </View>

          <TouchableOpacity
            style={styles.smallButton}
            onPress={async () => {
              if (!phraseVisible) {
                await ActivityService.addActivity(
                  'RECOVERY_VIEW',
                  'Recovery Phrase Viewed',
                  'Recovery phrase visibility was enabled'
                );
              }

              setPhraseVisible(!phraseVisible);
            }}
          >
            <Text style={styles.smallButtonText}>
              {phraseVisible ? 'HIDE PHRASE' : 'SHOW PHRASE'}
            </Text>
          </TouchableOpacity>

          {phraseVisible && (
            <ScrollView contentContainerStyle={styles.wordGrid}>
              {words.map((word, index) => (
                <View key={`${word}-${index}`} style={styles.wordBox}>
                  <Text style={styles.wordNumber}>{index + 1}</Text>
                  <Text style={styles.wordText}>{word}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={() => setShowMnemonic(false)}>
            <Text style={styles.closeButtonText}>I HAVE SECURED THESE WORDS</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      <ReceiveModal
        visible={receiveModalVisible}
        onClose={() => setReceiveModalVisible(false)}
        asset={selectedAsset}
      />
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Ron1nColors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  logoGraffiti: {
    width: 132,
    height: 132,
    resizeMode: 'contain',
    marginBottom: 10,
    borderRadius: 28,
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
    fontSize: 11,
    marginTop: 7,
    fontFamily: 'KatakanaStyle',
  },
  label: {
    color: Ron1nColors.gray,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 10,
    fontFamily: 'KatakanaStyle',
  },
  idText: {
    color: Ron1nColors.purple,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: Ron1nColors.purple,
    textShadowRadius: 10,
    fontFamily: 'KatakanaStyle',
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#00FF4118',
    borderWidth: 1,
    borderColor: '#00FF4144',
  },
  statusText: {
    color: Ron1nColors.green,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: Ron1nColors.green,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#00FF4112',
  },
  smallButtonBlue: {
    borderWidth: 1,
    borderColor: Ron1nColors.blue,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#00D4FF12',
  },
  smallButtonText: {
    color: Ron1nColors.green,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  smallButtonTextBlue: {
    color: Ron1nColors.blue,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: Ron1nColors.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'KatakanaStyle',
  },
  syncText: {
    color: Ron1nColors.blue,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  primaryButton: {
    height: 56,
    borderRadius: 999,
    backgroundColor: Ron1nColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: Ron1nColors.green,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  disclaimerBox: {
    backgroundColor: '#1a1a00',
    borderWidth: 1,
    borderColor: '#ffcc00',
    padding: 15,
    borderRadius: 12,
    marginVertical: 15,
    width: '90%',
  },
  disclaimerTitle: {
    color: '#ffcc00',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  disclaimerText: {
    color: '#ccc',
    fontSize: 10,
    lineHeight: 16,
    fontFamily: 'KatakanaStyle',
    marginTop: 5,
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
  },
  wordBox: {
    width: '45%',
    backgroundColor: '#111',
    padding: 8,
    margin: 4,
    borderRadius: 8,
    flexDirection: 'row',
  },
  wordNumber: {
    color: '#00FF41',
    fontSize: 9,
    width: 18,
    fontFamily: 'KatakanaStyle',
  },
  wordText: {
    color: '#C77DFF',
    fontSize: 11,
    fontFamily: 'KatakanaStyle',
  },
  closeButton: {
    width: '90%',
    height: 55,
    backgroundColor: '#00FF41',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  closeButtonText: {
    color: '#000',
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
});