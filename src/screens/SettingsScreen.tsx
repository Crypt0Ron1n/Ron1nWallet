import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Updates from 'expo-updates';

import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreen from '../components/Ron1nScreen';
import { ActivityService } from '../services/transactions/ActivityService';
import { ChainActivityCacheService } from '../services/transactions/ChainActivityCacheService';
import { AddressRotationPrepService } from '../services/security/AddressRotationPrepService';
import { PrivacyModeService } from '../services/PrivacyModeService';
import { ScreenProtectionService } from '../services/ScreenProtectionService';
import { SecurityPolicyService } from '../services/SecurityPolicyService';
import { VaultService } from '../services/VaultService';
import { Ron1nColors } from '../theme/ron1nTheme';

type SettingsMode = 'settings' | 'recovery';

export default function SettingsScreen() {
  const [mode, setMode] = useState<SettingsMode>('settings');
  const [privacyMode, setPrivacyMode] = useState(true);
  const [screenProtection, setScreenProtection] = useState(true);
  const [hasVault, setHasVault] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [phraseVisible, setPhraseVisible] = useState(false);
  const [chainCacheCount, setChainCacheCount] = useState(0);
  const [rotationPrepCount, setRotationPrepCount] = useState(0);
  const [activityCount, setActivityCount] = useState(0);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [
        enabled,
        captureProtection,
        mnemonic,
        chainCache,
        rotationRecords,
        activities,
      ] = await Promise.all([
        PrivacyModeService.isEnabled(),
        ScreenProtectionService.isEnabled(),
        VaultService.getMnemonic(),
        ChainActivityCacheService.getCache(),
        AddressRotationPrepService.getAll(),
        ActivityService.getActivities(),
      ]);

      setPrivacyMode(enabled);
      setScreenProtection(captureProtection);
      setHasVault(Boolean(mnemonic));
      setChainCacheCount(Object.keys(chainCache).length);
      setRotationPrepCount(rotationRecords.length);
      setActivityCount(activities.length);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setPrivacyMode(true);
      setScreenProtection(true);
      setHasVault(false);
      setChainCacheCount(0);
      setRotationPrepCount(0);
      setActivityCount(0);
    }
  };

  const authenticate = async (promptMessage: string) => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();

    if (!hasHardware) {
      Alert.alert(
        'Authentication Unavailable',
        'Biometric support is not available on this device.'
      );
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use device passcode',
    });

    if (!result.success) {
      Alert.alert('Blocked', 'Authentication failed.');
      return false;
    }

    return true;
  };

  const togglePrivacy = async (value: boolean) => {
    try {
      await PrivacyModeService.setEnabled(value);
      setPrivacyMode(value);

      await ActivityService.addActivity(
        'SECURITY',
        value ? 'Privacy Mode Enabled' : 'Privacy Mode Disabled',
        'User updated Privacy Mode setting'
      );

      await load();
    } catch (error) {
      Alert.alert('Error', 'Unable to update Privacy Mode.');
    }
  };

  const toggleScreenProtection = async (value: boolean) => {
    try {
      await ScreenProtectionService.setEnabled(value);
      setScreenProtection(value);

      await ActivityService.addActivity(
        'SECURITY',
        value ? 'Screen Capture Protection Enabled' : 'Screen Capture Protection Disabled',
        'User updated screen capture protection setting'
      );

      await load();
    } catch (error) {
      Alert.alert('Error', 'Unable to update screen capture protection.');
    }
  };

  const openRecoveryBackup = async () => {
    if (!hasVault) {
      Alert.alert('No Vault', 'No local vault was found on this device.');
      return;
    }

    const ok = await authenticate('Authenticate to Open Recovery Backup');

    if (!ok) {
      return;
    }

    try {
      const mnemonic = await VaultService.getMnemonic();

      if (!mnemonic) {
        Alert.alert('No Vault', 'No recovery phrase was found on this device.');
        return;
      }

      setRecoveryPhrase(mnemonic);
      setPhraseVisible(false);
      setMode('recovery');

      await ActivityService.addActivity(
        'SECURITY',
        'Recovery Backup Opened',
        'User authenticated to open recovery phrase backup screen'
      );

      await load();
    } catch (error) {
      Alert.alert('Error', 'Unable to open recovery phrase backup.');
    }
  };

  const revealPhrase = async () => {
    const ok = await authenticate('Authenticate to Reveal Recovery Phrase');

    if (!ok) {
      return;
    }

    setPhraseVisible(true);

    await ActivityService.addActivity(
      'SECURITY',
      'Recovery Phrase Revealed',
      'User authenticated to reveal recovery phrase'
    );

    await load();
  };

  const confirmBackedUp = async () => {
    Alert.alert(
      'Backup Confirmed',
      'Confirm that your recovery phrase is written down and stored offline. Anyone with this phrase can control the wallet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            await ActivityService.addActivity(
              'SECURITY',
              'Recovery Phrase Backup Confirmed',
              'User confirmed recovery phrase backup'
            );

            setPhraseVisible(false);
            setRecoveryPhrase('');
            setMode('settings');

            await load();

            Alert.alert('Confirmed', 'Recovery phrase backup confirmation saved locally.');
          },
        },
      ]
    );
  };

  const restartApp = async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.error('Reload failed:', error);

      Alert.alert(
        'Restart Required',
        'Local vault data was removed. Close and reopen the app to return to onboarding.'
      );
    }
  };

  const clearChainCache = async () => {
    const ok = await authenticate('Authenticate to Clear Chain Cache');

    if (!ok) {
      return;
    }

    Alert.alert(
      'Clear Chain Cache',
      'This clears cached public-chain history from this device. It does not affect your wallet, assets, addresses, or blockchain records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await ChainActivityCacheService.clearCache();

              await ActivityService.addActivity(
                'SECURITY',
                'Chain Activity Cache Cleared',
                'User cleared cached public-chain activity from this device'
              );

              await load();

              Alert.alert('Cleared', 'Cached chain activity has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Unable to clear chain cache.');
            }
          },
        },
      ]
    );
  };

  const clearRotationPrepRecords = async () => {
    const ok = await authenticate('Authenticate to Clear Rotation Prep Records');

    if (!ok) {
      return;
    }

    Alert.alert(
      'Clear Rotation Prep Records',
      'This clears local fresh receive address preparation records only. It does not move funds or affect blockchain history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AddressRotationPrepService.clearAll();

              await ActivityService.addActivity(
                'SECURITY',
                'Rotation Prep Records Cleared',
                'User cleared local address rotation prep records'
              );

              await load();

              Alert.alert('Cleared', 'Rotation prep records have been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Unable to clear rotation prep records.');
            }
          },
        },
      ]
    );
  };

  const clearLocalActivity = async () => {
    const ok = await authenticate('Authenticate to Clear Private Activity');

    if (!ok) {
      return;
    }

    Alert.alert(
      'Clear Private Activity',
      'This clears local private activity events from this device. It does not delete your wallet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await ActivityService.clearActivities();
              setActivityCount(0);

              Alert.alert('Cleared', 'Private activity has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Unable to clear private activity.');
            }
          },
        },
      ]
    );
  };

  const clearAllNonVaultData = async () => {
    const ok = await authenticate('Authenticate to Clear Local Data');

    if (!ok) {
      return;
    }

    Alert.alert(
      'Clear Local Non-Vault Data',
      'This clears private activity, cached chain activity, and rotation prep records. It does not delete your recovery phrase or local vault.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([
                ActivityService.clearActivities(),
                ChainActivityCacheService.clearCache(),
                AddressRotationPrepService.clearAll(),
              ]);

              setActivityCount(0);
              setChainCacheCount(0);
              setRotationPrepCount(0);

              Alert.alert('Cleared', 'Local non-vault data has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Unable to clear local non-vault data.');
            }
          },
        },
      ]
    );
  };

  const deleteLocalVault = async () => {
    const ok = await authenticate('Authenticate to Delete Local Vault');

    if (!ok) {
      return;
    }

    Alert.alert(
      'Delete Local Vault',
      'This removes the wallet vault from this device. It does not delete blockchain assets. You must have your recovery phrase to restore access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([
                VaultService.clearVault(),
                ActivityService.clearActivities(),
                ChainActivityCacheService.clearCache(),
                AddressRotationPrepService.clearAll(),
              ]);

              setHasVault(false);
              setRecoveryPhrase('');
              setPhraseVisible(false);
              setMode('settings');
              setActivityCount(0);
              setChainCacheCount(0);
              setRotationPrepCount(0);

              Alert.alert(
                'Vault Deleted',
                'Local vault data was removed. The app will restart to return to onboarding.',
                [
                  {
                    text: 'Restart',
                    onPress: restartApp,
                  },
                ]
              );
            } catch (error) {
              console.error('Delete local vault failed:', error);
              Alert.alert('Error', 'Unable to delete local vault.');
            }
          },
        },
      ]
    );
  };

  const closeRecoveryScreen = () => {
    setPhraseVisible(false);
    setRecoveryPhrase('');
    setMode('settings');
  };

  const renderRecoveryScreen = () => {
    const words = recoveryPhrase ? recoveryPhrase.split(' ') : [];

    return (
      <Ron1nScreen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />
            <Text style={styles.title}>RECOVERY BACKUP</Text>
            <Text style={styles.subtitle}>BIOMETRIC PROTECTED</Text>
          </View>

          <Ron1nCard>
            <Text style={styles.dangerTitle}>CRITICAL WARNING</Text>
            <Text style={styles.body}>
              Your recovery phrase controls your wallet. Do not screenshot, upload,
              text, email, or share this phrase. Ron1n Syndicate cannot recover it
              for you.
            </Text>
          </Ron1nCard>

          <Ron1nCard>
            <Text style={styles.sectionTitle}>RECOVERY PHRASE</Text>

            {!phraseVisible ? (
              <>
                <Text style={styles.body}>
                  The phrase is hidden. Authenticate again to reveal it.
                </Text>

                <TouchableOpacity onPress={revealPhrase} style={styles.actionButton}>
                  <Text style={styles.actionText}>REVEAL PHRASE</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.wordGrid}>
                  {words.map((word, index) => (
                    <View key={`${word}-${index}`} style={styles.wordBox}>
                      <Text style={styles.wordNumber}>{index + 1}</Text>
                      <Text style={styles.wordText}>{word}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => setPhraseVisible(false)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryText}>HIDE PHRASE</Text>
                </TouchableOpacity>
              </>
            )}
          </Ron1nCard>

          <TouchableOpacity onPress={confirmBackedUp} style={styles.primaryButton}>
            <Text style={styles.primaryText}>I HAVE BACKED THIS UP</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={closeRecoveryScreen} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>BACK TO SETTINGS</Text>
          </TouchableOpacity>
        </ScrollView>
      </Ron1nScreen>
    );
  };

  const renderSettingsScreen = () => (
    <Ron1nScreen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />
          <Text style={styles.title}>SETTINGS</Text>
          <Text style={styles.subtitle}>VAULT CONTROL CENTER</Text>
        </View>

        <Ron1nCard>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Privacy Mode</Text>
              <Text style={styles.body}>
                Prevent automatic public-chain polling. Manual sync requires consent.
              </Text>
            </View>

            <Switch
              value={privacyMode}
              onValueChange={togglePrivacy}
              trackColor={{ false: '#333333', true: '#00FF4166' }}
              thumbColor={privacyMode ? Ron1nColors.green : '#888888'}
            />
          </View>
        </Ron1nCard>

        <Ron1nCard>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Screen Capture Protection</Text>
              <Text style={styles.body}>
                Helps block screenshots and screen recording on sensitive wallet screens
                when supported by the device.
              </Text>
            </View>

            <Switch
              value={screenProtection}
              onValueChange={toggleScreenProtection}
              trackColor={{ false: '#333333', true: '#00FF4166' }}
              thumbColor={screenProtection ? Ron1nColors.green : '#888888'}
            />
          </View>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.sectionTitle}>VAULT</Text>

          <View style={styles.statusPill}>
            <Text style={styles.statusText}>
              {hasVault ? 'LOCAL VAULT DETECTED' : 'NO LOCAL VAULT'}
            </Text>
          </View>

          <TouchableOpacity onPress={openRecoveryBackup} style={styles.actionButton}>
            <Text style={styles.actionText}>RECOVERY PHRASE BACKUP</Text>
          </TouchableOpacity>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.sectionTitle}>LOCAL DATA CONTROLS</Text>

          <DataRow label="Private Activity" value={`${activityCount} events`} />
          <DataRow label="Chain Activity Cache" value={`${chainCacheCount} assets`} />
          <DataRow label="Rotation Prep Records" value={`${rotationPrepCount} records`} />

          <TouchableOpacity onPress={clearLocalActivity} style={styles.utilityButton}>
            <Text style={styles.utilityText}>CLEAR PRIVATE ACTIVITY</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={clearChainCache} style={styles.utilityButton}>
            <Text style={styles.utilityText}>CLEAR CHAIN CACHE</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={clearRotationPrepRecords} style={styles.utilityButton}>
            <Text style={styles.utilityText}>CLEAR ROTATION PREP RECORDS</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={clearAllNonVaultData} style={styles.warningButton}>
            <Text style={styles.warningText}>CLEAR ALL NON-VAULT DATA</Text>
          </TouchableOpacity>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.sectionTitle}>APP ENVIRONMENT</Text>
          <DataRow label="App" value="Ron1n Syndicate" />
          <DataRow label="Wallet UI" value="Shogun Wallet" />
          <DataRow label="Mode" value="Development Build" />
          <DataRow label="Custody" value="Self-Custodial" />
          <DataRow
            label="Screen Protection"
            value={screenProtection ? 'Enabled' : 'Disabled'}
          />
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.sectionTitle}>DISCLOSURES</Text>
          <Text style={styles.body}>{SecurityPolicyService.getNoCustodyDisclosure()}</Text>
          <Text style={styles.bodySpacer}>{SecurityPolicyService.getQuantumDisclosure()}</Text>
          <Text style={styles.bodySpacer}>{SecurityPolicyService.getFeeDisclosure()}</Text>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.dangerTitle}>DANGER ZONE</Text>
          <Text style={styles.body}>
            Use only if you have safely backed up your recovery phrase.
          </Text>

          <TouchableOpacity onPress={deleteLocalVault} style={styles.dangerButton}>
            <Text style={styles.dangerText}>DELETE LOCAL VAULT</Text>
          </TouchableOpacity>
        </Ron1nCard>
      </ScrollView>
    </Ron1nScreen>
  );

  return mode === 'recovery' ? renderRecoveryScreen() : renderSettingsScreen();
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  logo: {
    width: 108,
    height: 108,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  title: {
    color: Ron1nColors.gold,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  subtitle: {
    color: Ron1nColors.green,
    fontSize: 10,
    letterSpacing: 3,
    marginTop: 6,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    color: Ron1nColors.white,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
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
    fontSize: 12,
    lineHeight: 19,
  },
  bodySpacer: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 12,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#00FF4166',
    backgroundColor: '#00FF4112',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  statusText: {
    color: Ron1nColors.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  actionButton: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FFD70066',
    backgroundColor: '#FFD70012',
    alignItems: 'center',
  },
  actionText: {
    color: Ron1nColors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
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
  utilityButton: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#00FF4144',
    backgroundColor: '#00FF410D',
    alignItems: 'center',
  },
  utilityText: {
    color: Ron1nColors.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  warningButton: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#FFD70066',
    backgroundColor: '#FFD70012',
    alignItems: 'center',
  },
  warningText: {
    color: Ron1nColors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dangerTitle: {
    color: '#FF7777',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  dangerButton: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FF4D4D88',
    backgroundColor: '#FF4D4D18',
    alignItems: 'center',
  },
  dangerText: {
    color: '#FF7777',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
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
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    paddingVertical: 10,
  },
  dataLabel: {
    color: '#AAAAAA',
    fontSize: 12,
    flex: 1,
  },
  dataValue: {
    color: Ron1nColors.gold,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    flex: 1,
  },
});