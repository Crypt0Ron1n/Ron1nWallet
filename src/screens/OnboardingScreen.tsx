import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreen from '../components/Ron1nScreen';
import { ActivityService } from '../services/transactions/ActivityService';
import { VaultService } from '../services/VaultService';
import { Ron1nColors } from '../theme/ron1nTheme';

type OnboardingScreenProps = {
  onComplete: () => void;
};

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [restoreMode, setRestoreMode] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [generatedPhrase, setGeneratedPhrase] = useState('');
  const [showGeneratedPhrase, setShowGeneratedPhrase] = useState(false);
  const [busy, setBusy] = useState(false);

  const createWallet = async () => {
    try {
      setBusy(true);

      const mnemonic = generateMnemonic(wordlist, 128);

      await VaultService.saveMnemonic(mnemonic);

      await ActivityService.addActivity(
        'RESTORE',
        'Vault Created',
        'A new Shogun Wallet vault was created on this device'
      );

      setGeneratedPhrase(mnemonic);
      setShowGeneratedPhrase(true);
    } catch (error) {
      console.error('Create wallet failed:', error);
      Alert.alert('Error', 'Unable to create wallet vault.');
    } finally {
      setBusy(false);
    }
  };

  const finishCreatedWallet = () => {
    Alert.alert(
      'Recovery Phrase Warning',
      'Make sure your recovery phrase is written down and stored offline before continuing.',
      [
        { text: 'Review Again', style: 'cancel' },
        { text: 'Continue', onPress: onComplete },
      ]
    );
  };

  const restoreWallet = async () => {
    const phrase = recoveryPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
    const words = phrase.split(' ');

    if (words.length !== 12 && words.length !== 24) {
      Alert.alert('Invalid Phrase', 'Enter a valid 12 or 24 word recovery phrase.');
      return;
    }

    const isValid = validateMnemonic(phrase, wordlist);

    if (!isValid) {
      Alert.alert(
        'Invalid Recovery Phrase',
        'The recovery phrase is not valid. Check spelling and word order.'
      );
      return;
    }

    try {
      setBusy(true);

      await VaultService.saveMnemonic(phrase);

      await ActivityService.addActivity(
        'RESTORE',
        'Vault Restored',
        'A Shogun Wallet vault was restored on this device'
      );

      Alert.alert('Vault Restored', 'Your wallet vault was restored.', [
        { text: 'Continue', onPress: onComplete },
      ]);
    } catch (error) {
      console.error('Restore wallet failed:', error);
      Alert.alert('Error', 'Unable to restore wallet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Ron1nScreen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Image source={require('../../assets/rs-graffiti.png')} style={styles.logo} />
          <Text style={styles.title}>RON1N SYNDICATE</Text>
          <Text style={styles.subtitle}>SHOGUN WALLET</Text>
        </View>

        <Ron1nCard>
          <Text style={styles.sectionTitle}>SELF-CUSTODY FIRST</Text>
          <Text style={styles.body}>
            Shogun Wallet is a self-custodial wallet interface powered by the
            Ron1n Security Layer. Your recovery phrase controls your assets.
            Ron1n Syndicate does not custody your funds.
          </Text>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.sectionTitle}>PRIVACY MODE</Text>
          <Text style={styles.body}>
            Public-chain balances and activity are not fetched automatically.
            Manual sync requires user consent and device authentication.
          </Text>
        </Ron1nCard>

        {showGeneratedPhrase ? (
          <Ron1nCard>
            <Text style={styles.sectionTitle}>RECOVERY PHRASE</Text>

            <Text style={styles.warningText}>
              Write this down offline. Do not screenshot, upload, text, email, or share this phrase.
            </Text>

            <View style={styles.phraseBox}>
              <Text style={styles.phraseText}>{generatedPhrase}</Text>
            </View>

            <TouchableOpacity onPress={finishCreatedWallet} style={styles.primaryButton}>
              <Text style={styles.primaryText}>I SAVED MY PHRASE</Text>
            </TouchableOpacity>
          </Ron1nCard>
        ) : !restoreMode ? (
          <>
            <TouchableOpacity disabled={busy} onPress={createWallet} style={styles.primaryButton}>
              <Text style={styles.primaryText}>
                {busy ? 'CREATING...' : 'CREATE SHOGUN WALLET'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setRestoreMode(true)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>RESTORE EXISTING WALLET</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Ron1nCard>
            <Text style={styles.sectionTitle}>RESTORE WALLET</Text>

            <TextInput
              value={recoveryPhrase}
              onChangeText={setRecoveryPhrase}
              placeholder="Enter recovery phrase"
              placeholderTextColor="#666666"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={false}
              style={styles.input}
            />

            <TouchableOpacity disabled={busy} onPress={restoreWallet} style={styles.primaryButton}>
              <Text style={styles.primaryText}>
                {busy ? 'RESTORING...' : 'RESTORE VAULT'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setRestoreMode(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>BACK</Text>
            </TouchableOpacity>
          </Ron1nCard>
        )}
      </ScrollView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  logo: {
    width: 132,
    height: 132,
    resizeMode: 'contain',
    borderRadius: 28,
    marginBottom: 14,
  },
  title: {
    color: Ron1nColors.gold,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  subtitle: {
    color: Ron1nColors.green,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 8,
  },
  sectionTitle: {
    color: Ron1nColors.green,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 13,
    lineHeight: 21,
  },
  warningText: {
    color: '#FFDD77',
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 14,
  },
  phraseBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD70066',
    backgroundColor: '#000000',
    padding: 16,
    marginBottom: 14,
  },
  phraseText: {
    color: Ron1nColors.gold,
    fontSize: 15,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: 1,
  },
  primaryButton: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 16,
    backgroundColor: '#00FF4122',
    borderWidth: 1,
    borderColor: '#00FF4188',
    alignItems: 'center',
  },
  primaryText: {
    color: Ron1nColors.green,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#444444',
    alignItems: 'center',
  },
  secondaryText: {
    color: '#BBBBBB',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  input: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#000000',
    color: Ron1nColors.white,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 13,
    lineHeight: 20,
  },
});