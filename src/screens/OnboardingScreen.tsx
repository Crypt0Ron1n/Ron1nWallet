import React, { useMemo, useState } from 'react';
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

type OnboardingStep = 'intro' | 'show_phrase' | 'confirm_phrase' | 'restore';

const CONFIRM_WORD_INDEXES = [2, 6, 10];

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState<OnboardingStep>('intro');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [generatedPhrase, setGeneratedPhrase] = useState('');
  const [confirmWords, setConfirmWords] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const generatedWords = useMemo(() => {
    return generatedPhrase ? generatedPhrase.split(' ') : [];
  }, [generatedPhrase]);

  const createWallet = () => {
    const mnemonic = generateMnemonic(wordlist, 128);
    setGeneratedPhrase(mnemonic);
    setConfirmWords({});
    setStep('show_phrase');
  };

  const beginConfirmation = () => {
    if (!generatedPhrase) {
      Alert.alert('Error', 'No recovery phrase was generated.');
      return;
    }

    Alert.alert(
      'Confirm Recovery Phrase',
      'You will be asked to enter selected words from your recovery phrase. This confirms you saved it offline.',
      [
        { text: 'Review Again', style: 'cancel' },
        { text: 'Continue', onPress: () => setStep('confirm_phrase') },
      ]
    );
  };

  const updateConfirmWord = (index: number, value: string) => {
    setConfirmWords((current) => ({
      ...current,
      [index]: value.trim().toLowerCase(),
    }));
  };

  const confirmCreatedWallet = async () => {
    if (!generatedPhrase) {
      Alert.alert('Error', 'No recovery phrase was generated.');
      return;
    }

    for (const index of CONFIRM_WORD_INDEXES) {
      const expected = generatedWords[index];
      const entered = confirmWords[index];

      if (!entered || entered !== expected) {
        Alert.alert(
          'Incorrect Word',
          `Word #${index + 1} does not match. Please check your recovery phrase.`
        );
        return;
      }
    }

    try {
      setBusy(true);

      await VaultService.saveMnemonic(generatedPhrase);

      await ActivityService.addActivity(
        'SECURITY',
        'Recovery Phrase Confirmed',
        'User confirmed selected recovery phrase words before vault activation'
      );

      Alert.alert(
        'Vault Activated',
        'Your Shogun Wallet vault is now active on this device.',
        [{ text: 'Continue', onPress: onComplete }]
      );
    } catch (error) {
      console.error('Confirm wallet failed:', error);
      Alert.alert('Error', 'Unable to activate wallet vault.');
    } finally {
      setBusy(false);
    }
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

  const renderIntro = () => (
    <>
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

      <TouchableOpacity disabled={busy} onPress={createWallet} style={styles.primaryButton}>
        <Text style={styles.primaryText}>CREATE SHOGUN WALLET</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setStep('restore')} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>RESTORE EXISTING WALLET</Text>
      </TouchableOpacity>
    </>
  );

  const renderShowPhrase = () => (
    <Ron1nCard>
      <Text style={styles.sectionTitle}>RECOVERY PHRASE</Text>

      <Text style={styles.warningText}>
        Write this down offline. Do not screenshot, upload, text, email, or share this phrase.
      </Text>

      <View style={styles.wordGrid}>
        {generatedWords.map((word, index) => (
          <View key={`${word}-${index}`} style={styles.wordBox}>
            <Text style={styles.wordNumber}>{index + 1}</Text>
            <Text style={styles.wordText}>{word}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={beginConfirmation} style={styles.primaryButton}>
        <Text style={styles.primaryText}>I SAVED MY PHRASE</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setStep('intro')} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>START OVER</Text>
      </TouchableOpacity>
    </Ron1nCard>
  );

  const renderConfirmPhrase = () => (
    <Ron1nCard>
      <Text style={styles.sectionTitle}>CONFIRM RECOVERY PHRASE</Text>

      <Text style={styles.body}>
        Enter the requested words to confirm your recovery phrase backup.
      </Text>

      <View style={styles.confirmList}>
        {CONFIRM_WORD_INDEXES.map((index) => (
          <View key={index} style={styles.confirmItem}>
            <Text style={styles.confirmLabel}>WORD #{index + 1}</Text>

            <TextInput
              value={confirmWords[index] || ''}
              onChangeText={(value) => updateConfirmWord(index, value)}
              placeholder={`Enter word #${index + 1}`}
              placeholderTextColor="#666666"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.confirmInput}
            />
          </View>
        ))}
      </View>

      <TouchableOpacity
        disabled={busy}
        onPress={confirmCreatedWallet}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryText}>
          {busy ? 'ACTIVATING...' : 'CONFIRM AND ACTIVATE'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setStep('show_phrase')} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>REVIEW PHRASE AGAIN</Text>
      </TouchableOpacity>
    </Ron1nCard>
  );

  const renderRestore = () => (
    <Ron1nCard>
      <Text style={styles.sectionTitle}>RESTORE WALLET</Text>

      <Text style={styles.body}>
        Enter your existing 12 or 24 word recovery phrase to restore your local vault.
      </Text>

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

      <TouchableOpacity onPress={() => setStep('intro')} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>BACK</Text>
      </TouchableOpacity>
    </Ron1nCard>
  );

  return (
    <Ron1nScreen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Image source={require('../../assets/rs-graffiti.png')} style={styles.logo} />
          <Text style={styles.title}>RON1N SYNDICATE</Text>
          <Text style={styles.subtitle}>SHOGUN WALLET</Text>
        </View>

        {step === 'intro' && renderIntro()}
        {step === 'show_phrase' && renderShowPhrase()}
        {step === 'confirm_phrase' && renderConfirmPhrase()}
        {step === 'restore' && renderRestore()}
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
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  wordBox: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD70044',
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wordNumber: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 4,
  },
  wordText: {
    color: Ron1nColors.gold,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  confirmList: {
    marginTop: 14,
    gap: 12,
  },
  confirmItem: {
    gap: 6,
  },
  confirmLabel: {
    color: Ron1nColors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  confirmInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#000000',
    color: Ron1nColors.white,
    padding: 13,
    fontSize: 14,
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
    marginTop: 14,
  },
});