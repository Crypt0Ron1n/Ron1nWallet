import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { useFonts, ZenDots_400Regular } from '@expo-google-fonts/zen-dots';
import * as ScreenCapture from 'expo-screen-capture';
import * as Clipboard from 'expo-clipboard';

import { VaultService } from '../services/VaultService';
import { WalletService } from '../services/WalletService';
import { ActivityService } from '../services/ActivityService';
import ReceiveModal, { type AssetInfo } from '../components/ReceiveModal';
import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import Ron1nPressable from '../components/Ron1nPressable';
import Ron1nAssetCard from '../components/Ron1nAssetCard';
import { Ron1nColors } from '../theme/ron1nTheme';

const ASSET_ACCENTS: Record<string, string> = {
  ETH: Ron1nColors.blue,
  BTC: Ron1nColors.gold,
  LTC: Ron1nColors.green,
  SOL: Ron1nColors.purple,
  XRP: Ron1nColors.blue,
  XLM: Ron1nColors.green,
  ALGO: Ron1nColors.gold,
  AVAX: '#E84142',
  CRO: '#103F68',
  BERA: '#F5B642',
  BASE: Ron1nColors.blue,
  POL: Ron1nColors.purple,
  ARB: Ron1nColors.blue,
};

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

          await ActivityService.addActivity(
            'RESTORE',
            'Wallet Restored',
            'Vault loaded from SecureStore'
          );

          if (__DEV__) console.log('Wallet restored from secure storage');
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
          if (__DEV__) console.log('Screen capture protection enabled');
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

      const mnemonicArray = mnemonic.split(' ');

      const ethWallet = WalletService.getEthereumWallet(mnemonic);
      const btcWallet = WalletService.getBitcoinWallet(mnemonic);
      const ltcWallet = WalletService.getLitecoinWallet(mnemonic);
      const solWallet = WalletService.getSolanaWallet(mnemonic);
      const xrpWallet = WalletService.getXrpWallet(mnemonic);
      const xlmWallet = WalletService.getStellarWallet(mnemonic);
const algoWallet = WalletService.getAlgorandWallet(mnemonic);

      setEthAddress(ethWallet.address);
      setBtcAddress(btcWallet.address);
      setLtcAddress(ltcWallet.address);
      setSolAddress(solWallet.address);
      setXrpAddress(xrpWallet.address);
      setXlmAddress(xlmWallet.address);
setAlgoAddress(algoWallet.address);

      if (__DEV__) {
        console.log('ETH Address:', ethWallet.address);
        console.log('BTC Address:', btcWallet.address);
        console.log('LTC Address:', ltcWallet.address);
        console.log('SOL Address:', solWallet.address);
      }

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

const myAssets = [
  { symbol: 'ETH', name: 'Ethereum', address: ethAddress },
  { symbol: 'BTC', name: 'Bitcoin', address: btcAddress },
  { symbol: 'LTC', name: 'Litecoin', address: ltcAddress },
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
          <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />
          <Text style={styles.brand}>RON1N WALLET</Text>
          <Text style={styles.subtitle}>Private by Default. Quantum Ready.</Text>
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

        <Text style={styles.sectionTitle}>QUANTUM ASSETS</Text>

        {myAssets.map((asset) => (
          <Ron1nAssetCard
            key={asset.symbol}
            symbol={asset.symbol}
            name={asset.name}
            address={asset.address}
            accent={ASSET_ACCENTS[asset.symbol] || Ron1nColors.green}
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
        ))}

<Text style={styles.sectionTitle}>EVM NETWORKS</Text>

{evmAssets.map((asset) => (
  <Ron1nAssetCard
    key={asset.symbol}
    symbol={asset.symbol}
    name={asset.name}
    address={asset.address}
    accent={ASSET_ACCENTS[asset.symbol] || Ron1nColors.blue}
    onPress={async () => {
      await ActivityService.addActivity(
        'RECEIVE_VIEW',
        `Viewed ${asset.symbol} Receive`,
        `${asset.name} uses your EVM address`
      );

      setSelectedAsset(asset);
      setReceiveModalVisible(true);
    }}
  />
))}

        <Text style={styles.sectionTitle}>COMING SOON</Text>
        <View style={styles.comingGrid}>
          {['HBAR', 'SUI', 'ADA', 'ICP', 'ZEC', 'XMR'].map((asset) => (
            <View key={asset} style={styles.comingCard}>
              <Text style={styles.comingAsset}>{asset}</Text>
              <Text style={styles.comingText}>COMING SOON</Text>
            </View>
          ))}
        </View>

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
  logo: {
    width: 118,
    height: 118,
    resizeMode: 'contain',
    marginBottom: 8,
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
  sectionTitle: {
    color: Ron1nColors.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
    fontFamily: 'KatakanaStyle',
  },
  comingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    marginBottom: 18,
  },
  comingCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 18,
    padding: 14,
  },
  comingAsset: {
    color: Ron1nColors.gray,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  comingText: {
    color: Ron1nColors.muted,
    fontSize: 9,
    marginTop: 8,
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