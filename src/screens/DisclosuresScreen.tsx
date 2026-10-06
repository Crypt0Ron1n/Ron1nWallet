import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreenHeader from '../components/Ron1nScreenHeader';
import { SecurityPolicyService } from '../services/SecurityPolicyService';
import { Ron1nColors, Ron1nSpacing, Ron1nTypography } from '../theme/ron1nTheme';

export default function DisclosuresScreen() {
  const rules = SecurityPolicyService.getCoreRules();

  return (
    <Ron1nScreen>
      <SafeAreaView>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Ron1nScreenHeader
            title="DISCLOSURES"
            subtitle="Security, privacy, network fees, and self-custody notices"
            accent="gold"
          />

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
  cardTitle: {
    ...Ron1nTypography.cardTitle,
    color: Ron1nColors.white,
    marginBottom: Ron1nSpacing.sm,
  },
  body: {
    ...Ron1nTypography.body,
    color: '#CCCCCC',
  },
  ruleRow: {
    flexDirection: 'row',
    gap: Ron1nSpacing.sm,
    marginTop: Ron1nSpacing.md,
  },
  ruleNumber: {
    color: Ron1nColors.gold,
    fontSize: 11,
    fontWeight: '900',
    width: 22,
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