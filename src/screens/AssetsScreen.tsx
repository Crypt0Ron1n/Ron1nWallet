import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { getAssetsByCategory } from '../config/assetCatalog';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function AssetsScreen() {
  const nativeAssets = getAssetsByCategory('Native');
  const evmNetworks = getAssetsByCategory('EVM');
  const tokens = getAssetsByCategory('Token');
  const futureAssets = getAssetsByCategory('Future');

  return (
    <Ron1nScreen>
      <SafeAreaView>
        <View style={styles.hero}>
          <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />
          <Text style={styles.title}>ASSET LAYER</Text>
          <Text style={styles.subtitle}>
            Your assets remain yours. Ron1n adds security visibility.
          </Text>
        </View>

        <Ron1nCard>
          <Text style={styles.cardTitle}>NATIVE WALLETS</Text>
          <View style={styles.grid}>
            {nativeAssets.map((asset) => (
              <View key={asset.symbol} style={styles.assetPill}>
                <Text style={styles.assetText}>{asset.symbol}</Text>
              </View>
            ))}
          </View>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>EVM NETWORKS</Text>
          <View style={styles.grid}>
            {evmNetworks.map((network) => (
              <View key={network.symbol} style={styles.networkPill}>
                <Text style={styles.networkText}>{network.name}</Text>
              </View>
            ))}
          </View>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>TOKENS</Text>
          <Text style={styles.cardText}>
            Token support is display/send-review architecture only. Ron1n does not
            issue, wrap, custody, or synthesize user assets.
          </Text>

          <View style={styles.grid}>
            {tokens.map((token) => (
              <View key={token.symbol} style={styles.tokenPill}>
                <Text style={styles.tokenText}>{token.symbol}</Text>
              </View>
            ))}
          </View>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>FUTURE NATIVE SUPPORT</Text>
          <View style={styles.grid}>
            {futureAssets.map((asset) => (
              <View key={asset.symbol} style={styles.futurePill}>
                <Text style={styles.futureText}>{asset.symbol}</Text>
              </View>
            ))}
          </View>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>SECURITY STATES</Text>
          <Text style={styles.green}>● Protected — address hygiene complete</Text>
          <Text style={styles.blue}>● Quantum Ready — monitored and vault-secured</Text>
          <Text style={styles.purple}>● Vault Secured — keys protected locally</Text>
          <Text style={styles.red}>● Rotation Recommended — exposure detected</Text>
        </Ron1nCard>
      </SafeAreaView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  logo: {
    width: 118,
    height: 118,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  title: {
    color: Ron1nColors.gold,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'KatakanaStyle',
  },
  subtitle: {
    color: Ron1nColors.gray,
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'KatakanaStyle',
  },
  cardTitle: {
    color: Ron1nColors.white,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
    marginBottom: 12,
  },
  cardText: {
    color: '#AAAAAA',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  assetPill: {
    borderWidth: 1,
    borderColor: '#00FF4155',
    backgroundColor: '#00FF4112',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  assetText: {
    color: Ron1nColors.green,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  networkPill: {
    borderWidth: 1,
    borderColor: '#00D4FF55',
    backgroundColor: '#00D4FF12',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  networkText: {
    color: Ron1nColors.blue,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  tokenPill: {
    borderWidth: 1,
    borderColor: '#B026FF55',
    backgroundColor: '#B026FF12',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tokenText: {
    color: Ron1nColors.purple,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  futurePill: {
    borderWidth: 1,
    borderColor: '#FFD70055',
    backgroundColor: '#FFD70012',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  futureText: {
    color: Ron1nColors.gold,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  green: { color: Ron1nColors.green, marginTop: 8, fontSize: 12 },
  blue: { color: Ron1nColors.blue, marginTop: 8, fontSize: 12 },
  purple: { color: Ron1nColors.purple, marginTop: 8, fontSize: 12 },
  red: { color: Ron1nColors.red, marginTop: 8, fontSize: 12 },
});