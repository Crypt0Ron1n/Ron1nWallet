import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function RFTsScreen() {
  return (
    <Ron1nScreen>
      <SafeAreaView>
        <View style={styles.hero}>
          <Image source={require('../../assets/rs-graffiti.png')} style={styles.logo} />
          <Text style={styles.title}>RON1N SYNDICATE</Text>
          <Text style={styles.subtitle}>RFT ownership layer coming online.</Text>
        </View>

        <Ron1nCard>
          <Text style={styles.cardTitle}>GENESIS RFTS</Text>
          <Text style={styles.cardText}>
            Founder Shards, Masks, Katanas, and Quantum Bytes migration assets will live here.
          </Text>
          <Text style={styles.status}>STATUS: PRE-MINT ARCHITECTURE</Text>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.cardTitle}>SECURITY MODEL</Text>
          <Text style={styles.green}>● Internal RFTs: PQ Protected</Text>
          <Text style={styles.blue}>● Marketplace Listings: Private by default</Text>
          <Text style={styles.purple}>● External Export: user warning required</Text>
        </Ron1nCard>
      </SafeAreaView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 22,
  },
  logo: {
    width: 135,
    height: 135,
    borderRadius: 28,
    resizeMode: 'cover',
    marginBottom: 14,
  },
  title: {
    color: Ron1nColors.purple,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'KatakanaStyle',
    textAlign: 'center',
  },
  subtitle: {
    color: Ron1nColors.green,
    fontSize: 11,
    marginTop: 8,
    fontFamily: 'KatakanaStyle',
    textAlign: 'center',
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
    color: Ron1nColors.green,
    fontSize: 11,
    marginTop: 16,
    fontFamily: 'KatakanaStyle',
  },
  green: { color: Ron1nColors.green, marginTop: 12 },
  blue: { color: Ron1nColors.blue, marginTop: 8 },
  purple: { color: Ron1nColors.purple, marginTop: 8 },
});