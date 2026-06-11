import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function MarketplaceScreen() {
  return (
    <Ron1nScreen>
      <SafeAreaView>
        <View style={styles.hero}>
          <Image source={require('../../assets/rs-graffiti.png')} style={styles.logo} />
          <Text style={styles.title}>MARKET</Text>
          <Text style={styles.subtitle}>Gasless private trading inside Ron1n.</Text>
        </View>

        <Ron1nCard>
          <Text style={styles.cardTitle}>INTERNAL MARKETPLACE</Text>
          <Text style={styles.cardText}>
            RFT ↔ qRON1N and RFT ↔ RFT trading will be private-first inside Ron1n.
          </Text>
          <Text style={styles.status}>STATUS: DESIGNING TRADE ENGINE</Text>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>MARKET RULES</Text>
          <Text style={styles.green}>● Internal trades: gasless</Text>
          <Text style={styles.blue}>● Private ledger: encrypted history</Text>
          <Text style={styles.red}>● External transfer: public-chain disclaimer</Text>
        </Ron1nCard>
      </SafeAreaView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 12, marginBottom: 22 },
  logo: {
    width: 130,
    height: 130,
    borderRadius: 28,
    resizeMode: 'cover',
    marginBottom: 14,
  },
  title: {
    color: Ron1nColors.green,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 4,
    fontFamily: 'KatakanaStyle',
  },
  subtitle: {
    color: Ron1nColors.gray,
    fontSize: 11,
    marginTop: 8,
    fontFamily: 'KatakanaStyle',
  },
  cardTitle: {
    color: Ron1nColors.white,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  cardText: {
    color: '#AAAAAA',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
  },
  status: {
    color: Ron1nColors.purple,
    fontSize: 11,
    marginTop: 16,
    fontFamily: 'KatakanaStyle',
  },
  green: { color: Ron1nColors.green, marginTop: 12 },
  blue: { color: Ron1nColors.blue, marginTop: 8 },
  red: { color: Ron1nColors.red, marginTop: 8 },
});