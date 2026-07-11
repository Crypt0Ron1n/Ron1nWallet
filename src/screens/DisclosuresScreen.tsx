import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { SecurityPolicyService } from '../services/SecurityPolicyService';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function DisclosuresScreen() {
  const rules = SecurityPolicyService.getCoreRules();

  return (
    <Ron1nScreen>
      <SafeAreaView>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />

            <Text style={styles.title}>DISCLOSURES</Text>

            <Text style={styles.subtitle}>
              Security, privacy, network fees, and self-custody notices.
            </Text>
          </View>

          <Ron1nCard>
            <Text style={styles.cardTitle}>SELF-CUSTODY</Text>
            <Text style={styles.body}>
              {SecurityPolicyService.getNoCustodyDisclosure()}
            </Text>
          </Ron1nCard>

          <Ron1nCard>
            <Text style={styles.cardTitle}>NETWORK FEES</Text>
            <Text style={styles.body}>
              {SecurityPolicyService.getFeeDisclosure()}
            </Text>
          </Ron1nCard>

          <Ron1nCard>
            <Text style={styles.cardTitle}>PRIVACY</Text>
            <Text style={styles.body}>
              {SecurityPolicyService.getPrivacyDisclosure()}
            </Text>
          </Ron1nCard>

          <Ron1nCard>
            <Text style={styles.cardTitle}>QUANTUM READINESS</Text>
            <Text style={styles.body}>
              {SecurityPolicyService.getQuantumDisclosure()}
            </Text>
          </Ron1nCard>

          <Ron1nCard>
            <Text style={styles.cardTitle}>NO INVESTMENT ADVICE</Text>
            <Text style={styles.body}>
              {SecurityPolicyService.getNoAdviceDisclosure()}
            </Text>
          </Ron1nCard>

          <Ron1nCard>
            <Text style={styles.cardTitle}>CORE RULES</Text>

            {rules.map((rule, index) => (
              <View key={rule} style={styles.ruleRow}>
                <Text style={styles.ruleNumber}>{index + 1}</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </Ron1nCard>

          <View style={styles.bottomSpace} />
        </ScrollView>
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
    width: 112,
    height: 112,
    resizeMode: 'contain',
    marginBottom: 10,
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
    marginBottom: 10,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 19,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  ruleNumber: {
    color: Ron1nColors.gold,
    fontSize: 11,
    fontWeight: '900',
    width: 22,
    fontFamily: 'KatakanaStyle',
  },
  ruleText: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  bottomSpace: {
    height: 110,
  },
});