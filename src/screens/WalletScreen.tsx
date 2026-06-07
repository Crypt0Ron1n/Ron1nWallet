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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { useFonts, ZenDots_400Regular } from '@expo-google-fonts/zen-dots';
import * as ScreenCapture from 'expo-screen-capture';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';

import { VaultService } from '../services/VaultService';
import { WalletService } from '../services/WalletService';
import ReceiveModal, { type AssetInfo } from '../components/ReceiveModal';

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

  const [fontsLoaded] = useFonts({
    KatakanaStyle: ZenDots_400Regular,
  });

  useEffect(() => {
    const secureApp = async () => {
      try {
        const id = await VaultService.getIdentity();

        if (id) {
          setSynID(id);
        }

        const mnemonic = await VaultService.getMnemonic();

        if (mnemonic) {
          const eth = WalletService.getEthereumWallet(mnemonic);
          const btc = WalletService.getBitcoinWallet(mnemonic);
          const ltc = WalletService.getLitecoinWallet(mnemonic);
          const sol = WalletService.getSolanaWallet(mnemonic);

          setEthAddress(eth.address);
          setBtcAddress(btc.address);
          setLtcAddress(ltc.address);
          setSolAddress(sol.address);

          if (__DEV__) {
            console.log('Wallet restored from secure storage');
          }
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

          if (__DEV__) {
            console.log('Screen capture protection enabled');
          }
        } catch (e) {
          if (__DEV__) {
            console.warn('Screen capture protection not ready yet:', e);
          }
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

    await Clipboard.setStringAsync(synID);

    if (__DEV__) {
      console.log('Syn-ID copied');
    }
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

      setEthAddress(ethWallet.address);
      setBtcAddress(btcWallet.address);
      setLtcAddress(ltcWallet.address);
      setSolAddress(solWallet.address);

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

      if (__DEV__) {
        console.log('Vault Save Successful:', newID);
      }

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
  ].filter(
    (asset): asset is AssetInfo =>
      typeof asset.address === 'string' && asset.address.length > 0
  );

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.glowOverlay} />
        <View style={styles.greenGlow} />
        <ActivityIndicator size="large" color="#00FF41" />
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient
      colors={['#050505', '#0A0014', '#050505']}
      style={styles.container}
    >
      <View style={styles.glowOverlay} />
      <View style={styles.greenGlow} />

      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.brand}>RON1N</Text>
        <Text style={styles.subtitle}>QUANTUM IDENTITY // ロニン</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>SYNDICATE ID</Text>
        <Text style={styles.idText}>{synID || '---- ---- ----'}</Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {synID ? 'QUANTUM HARDENED' : 'PENDING FORGE'}
          </Text>
        </View>

        {synID && (
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.smallButton} onPress={copySynID}>
              <Text style={styles.smallButtonText}>COPY ID</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => {
                setSelectedAsset({
                  symbol: 'SYN-ID',
                  name: 'Syndicate Identity',
                  address: synID,
                });
                setReceiveModalVisible(true);
              }}
            >
              <Text style={styles.smallButtonText}>RECEIVE</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.assetContainer}>
        <Text style={styles.label}>QUANTUM ASSETS</Text>

        <ScrollView style={styles.assetScroll} showsVerticalScrollIndicator={false}>
          {myAssets.map((asset) => (
            <TouchableOpacity
              key={asset.symbol}
              style={styles.assetRow}
              onPress={() => {
                setSelectedAsset(asset);
                setReceiveModalVisible(true);
              }}
            >
              <Text style={styles.assetName}>{asset.symbol}</Text>
              <Text style={styles.assetBalance}>{asset.address.slice(0, 10)}...</Text>
            </TouchableOpacity>
          ))}

          {['HBAR', 'XRP', 'XLM', 'ALGO'].map((asset) => (
            <View key={asset} style={styles.assetRowDisabled}>
              <Text style={styles.assetNameDisabled}>{asset}</Text>
              <Text style={styles.assetBalanceDisabled}>COMING SOON</Text>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.swapButton}>
          <Text style={styles.swapButtonText}>SWAP TO QUANTUM</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={forgeIdentity}>
        <Text style={styles.buttonText}>{synID ? 'RE-FORGE' : 'FORGE ID'}</Text>
      </TouchableOpacity>

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
            onPress={() => setPhraseVisible(!phraseVisible)}
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

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowMnemonic(false)}
          >
            <Text style={styles.closeButtonText}>
              I HAVE SECURED THESE WORDS
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      <ReceiveModal
        visible={receiveModalVisible}
        onClose={() => setReceiveModalVisible(false)}
        asset={selectedAsset}
      />
    </LinearGradient>
  );
}

const PURPLE = '#B026FF';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 40,
    position: 'relative',
  },
  header: {
    alignItems: 'center',
  },
  brand: {
    color: PURPLE,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 5,
    textShadowColor: PURPLE,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    fontFamily: 'KatakanaStyle',
  },
  subtitle: {
    color: '#00FF41',
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 5,
    fontFamily: 'KatakanaStyle',
  },
  card: {
    width: '85%',
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
  },
  label: {
    color: '#555',
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 10,
    alignSelf: 'flex-start',
    fontFamily: 'KatakanaStyle',
  },
  idText: {
    color: PURPLE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: PURPLE,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    fontFamily: 'KatakanaStyle',
    marginTop: 15,
  },
  badge: {
    marginTop: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#00FF4122',
  },
  badgeText: {
    color: '#00FF41',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'KatakanaStyle',
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  smallButton: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#00FF41',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  smallButtonText: {
    color: '#00FF41',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  assetContainer: {
    width: '85%',
    marginTop: 10,
  },
  assetScroll: {
    maxHeight: 220,
    marginTop: 5,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  assetName: {
    color: '#00FF41',
    fontWeight: '700',
    opacity: 0.9,
    fontSize: 13,
    fontFamily: 'KatakanaStyle',
  },
  assetBalance: {
    color: PURPLE,
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.85,
    fontFamily: 'KatakanaStyle',
  },
  assetRowDisabled: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    opacity: 0.4,
  },
  assetNameDisabled: {
    color: '#00FF41',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'KatakanaStyle',
  },
  assetBalanceDisabled: {
    color: PURPLE,
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'KatakanaStyle',
  },
  swapButton: {
    marginTop: 15,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#00FF41',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#00FF41',
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  swapButtonText: {
    color: '#00FF41',
    fontWeight: '700',
    fontSize: 10,
    fontFamily: 'KatakanaStyle',
  },
  button: {
    width: '85%',
    height: 55,
    backgroundColor: '#fff',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  buttonText: {
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
  glowOverlay: {
    position: 'absolute',
    width: 300,
    height: 300,
    backgroundColor: '#B026FF',
    opacity: 0.15,
    borderRadius: 200,
    top: 80,
    alignSelf: 'center',
  },
  greenGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    backgroundColor: '#00FF41',
    opacity: 0.08,
    borderRadius: 200,
    top: 140,
    alignSelf: 'center',
  },
});