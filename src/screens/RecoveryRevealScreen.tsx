import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { CryptoCore } from '../services/crypto/CryptoCore';
import { ActivityService } from '../services/transactions/ActivityService';
import { Ron1nColors } from '../theme/ron1nTheme';

interface Props {
  onBack: () => void;
}

export default function RecoveryRevealScreen({ onBack }: Props) {
  const [mnemonic, setMnemonic] = useState<string[] | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuthenticateAndReveal = async () => {
    try {
      setLoading(true);
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert('Error', 'Biometric security hardware not available.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to view recovery phrase',
        fallbackLabel: 'Use device passcode',
      });

      if (!result.success) {
        Alert.alert('Access Denied', 'Biometric verification failed.');
        return;
      }

      const storedMnemonic = await CryptoCore.revealRecoveryPhrase();

      setMnemonic(storedMnemonic.split(' '));
      setIsRevealed(true);

      await ActivityService.addActivity(
        'SECURITY',
        'Recovery Phrase Viewed',
        'User successfully authenticated and viewed master recovery phrase'
      );
    } catch (error) {
      console.error('Failed to reveal mnemonic:', error);
      Alert.alert('Error', 'Could not retrieve recovery phrase.');
    } finally {
      setLoading(false);
    }
  };

  const handleHide = () => {
    setMnemonic(null);
    setIsRevealed(false);
  };

  return (
    <Ron1nScreen>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>VAULT BACKUP</Text>
          <Text style={styles.subtitle}>
            BIOMETRIC-GATED RECOVERY ACCESS // ZERO-KNOWLEDGE LAYER
          </Text>

          <Ron1nCard>
            <Text style={styles.warningTitle}>SECURITY PROTOCOL ACTIVE</Text>
            <Text style={styles.warningText}>
              Your master phrase controls every asset across all integrated chains. Revealing this phrase exposes your vault to anyone with physical or visual access to your screen.
            </Text>
          </Ron1nCard>

          {!isRevealed ? (
            <View style={styles.authContainer}>
              <TouchableOpacity
                style={styles.revealButton}
                disabled={loading}
                onPress={handleAuthenticateAndReveal}
              >
                <Text style={styles.revealButtonText}>
                  {loading ? 'VERIFYING...' : 'AUTHENTICATE TO REVEAL'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.phraseContainer}>
              <Text style={styles.sectionLabel}>MASTER PHRASE UNLOCKED</Text>
              <View style={styles.wordGrid}>
                {mnemonic?.map((word, index) => (
                  <View key={index} style={styles.wordBox}>
                    <Text style={styles.wordIndex}>{index + 1}</Text>
                    <Text style={styles.wordText}>{word}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.hideButton} onPress={handleHide}>
                <Text style={styles.hideButtonText}>HIDE PHRASE IMMEDIATELY</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>RETURN TO SETTINGS</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16, paddingBottom: 60 },
  title: {
    color: Ron1nColors.gold,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    fontFamily: 'KatakanaStyle',
  },
  subtitle: {
    color: Ron1nColors.green,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    fontFamily: 'KatakanaStyle',
  },
  warningTitle: {
    color: '#FF4141',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: 'KatakanaStyle',
  },
  warningText: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
  },
  authContainer: {
    marginVertical: 30,
    alignItems: 'center',
  },
  revealButton: {
    backgroundColor: '#FFD70015',
    borderColor: Ron1nColors.gold,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  revealButtonText: {
    color: Ron1nColors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'KatakanaStyle',
  },
  phraseContainer: { marginVertical: 16 },
  sectionLabel: {
    color: Ron1nColors.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
    fontFamily: 'KatakanaStyle',
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordBox: {
    width: '30%',
    backgroundColor: '#111',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordIndex: {
    color: Ron1nColors.gray,
    fontSize: 9,
    fontWeight: '700',
  },
  wordText: {
    color: Ron1nColors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  hideButton: {
    backgroundColor: '#FF414122',
    borderColor: '#FF4141',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  hideButtonText: {
    color: '#FF4141',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'KatakanaStyle',
  },
  backButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  backButtonText: {
    color: Ron1nColors.gray,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'KatakanaStyle',
  },
});