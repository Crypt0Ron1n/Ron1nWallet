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
import * as SecureStore from 'expo-secure-store';

import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreen from '../components/Ron1nScreen';
import { ActivityService } from '../services/transactions/ActivityService';
import { PrivacyModeService } from '../services/PrivacyModeService';
import { SecurityPolicyService } from '../services/SecurityPolicyService';
import { VaultService } from '../services/VaultService';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function SettingsScreen() {
  const [privacyMode, setPrivacyMode] = useState(true);
  const [hasVault, setHasVault] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const enabled = await PrivacyModeService.isEnabled();
      const mnemonic = await VaultService.getMnemonic();

      setPrivacyMode(enabled);
      setHasVault(Boolean(mnemonic));
    } catch (error) {
      console.error('Settings load failed:', error);
      setPrivacyMode(true);
      setHasVault(false);
    }
  };

  const addSafeActivity = async (
    type: string,
    title: string,
    description: string
  ) => {
    try {
      await ActivityService.addActivity(type as any, title, description);
    } catch (error) {
      console.log('Activity log skipped:', error);
    }
  };

  const clearLocalActivity = async () => {
    const activityService = ActivityService as any;

    if (typeof activityService.clearActivities === 'function') {
      await activityService.clearActivities();
      return;
    }

    if (typeof activityService.clearActivity === 'function') {
      await activityService.clearActivity();
      return;
    }

    if (typeof activityService.clearAll === 'function') {
      await activityService.clearAll();
      return;
    }

    if (typeof activityService.deleteAll === 'function') {
      await activityService.deleteAll();
      return;
    }

    console.log('No activity clear method found. Skipping local activity clear.');
  };

  const clearLocalVault = async () => {
    const vaultService = VaultService as any;

    if (typeof vaultService.clearVault === 'function') {
      await vaultService.clearVault();
      return;
    }

    if (typeof vaultService.deleteVault === 'function') {
      await vaultService.deleteVault();
      return;
    }

    if (typeof vaultService.clearMnemonic === 'function') {
      await vaultService.clearMnemonic();
      return;
    }

    if (typeof vaultService.deleteMnemonic === 'function') {
      await vaultService.deleteMnemonic();
      return;
    }

    await SecureStore.deleteItemAsync('user_mnemonic');
    await SecureStore.deleteItemAsync('ron1n_mnemonic');
    await SecureStore.deleteItemAsync('shogun_mnemonic');
    await SecureStore.deleteItemAsync('wallet_mnemonic');
    await SecureStore.deleteItemAsync('vault_mnemonic');
    await SecureStore.deleteItemAsync('ron1n_syn_id');
  };

  const togglePrivacy = async (value: boolean) => {
    try {
      await PrivacyModeService.setEnabled(value);
      setPrivacyMode(value);

      await addSafeActivity(
        'SECURITY',
        value ? 'Privacy Mode Enabled' : 'Privacy Mode Disabled',
        'User updated Privacy Mode setting'
      );
    } catch (error) {
      console.error('Privacy toggle failed:', error);
      Alert.alert('Error', 'Unable to update Privacy Mode.');
    }
  };

  const showRecoveryWarning = async () => {
    if (!hasVault) {
      Alert.alert('No Vault', 'No local vault was found on this device.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to View Recovery Phrase',
      fallbackLabel: 'Use device passcode',
    });

    if (!result.success) {
      Alert.alert('Blocked', 'Authentication failed.');
      return;
    }

    Alert.alert(
      'Recovery Phrase',
      'For safety, do not screenshot, copy, or share your recovery phrase. Build the dedicated recovery phrase reveal screen next before showing this in production.'
    );
  };

  const deleteLocalVault = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to Delete Local Vault',
      fallbackLabel: 'Use device passcode',
    });

    if (!result.success) {
      Alert.alert('Blocked', 'Authentication failed.');
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
              await clearLocalVault();
              await clearLocalActivity();

              setHasVault(false);

              Alert.alert('Vault Deleted', 'Local vault data was removed.');
            } catch (error) {
              console.error('Delete local vault failed:', error);
              Alert.alert('Error', 'Unable to delete local vault.');
            }
          },
        },
      ]
    );
  };

  const getNoCustodyDisclosure = () => {
    const service = SecurityPolicyService as any;

    if (typeof service.getNoCustodyDisclosure === 'function') {
      return service.getNoCustodyDisclosure();
    }

    return 'Ron1n Syndicate does not custody user funds, recovery phrases, or private keys.';
  };

  const getQuantumDisclosure = () => {
    const service = SecurityPolicyService as any;

    if (typeof service.getQuantumDisclosure === 'function') {
      return service.getQuantumDisclosure();
    }

    return 'Quantum-ready features improve wallet security posture but do not make external public blockchains quantum-proof.';
  };

  const getFeeDisclosure = () => {
    const service = SecurityPolicyService as any;

    if (typeof service.getFeeDisclosure === 'function') {
      return service.getFeeDisclosure();
    }

    return 'Network fees are paid to the selected blockchain network. Ron1n Syndicate does not create, control, or receive network fees.';
  };

  return (
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
          <Text style={styles.sectionTitle}>VAULT</Text>

          <View style={styles.statusPill}>
            <Text style={styles.statusText}>
              {hasVault ? 'LOCAL VAULT DETECTED' : 'NO LOCAL VAULT'}
            </Text>
          </View>

          <TouchableOpacity onPress={showRecoveryWarning} style={styles.actionButton}>
            <Text style={styles.actionText}>RECOVERY PHRASE BACKUP</Text>
          </TouchableOpacity>
        </Ron1nCard>

        <Ron1nCard>
          <Text style={styles.sectionTitle}>DISCLOSURES</Text>
          <Text style={styles.body}>{getNoCustodyDisclosure()}</Text>
          <Text style={styles.bodySpacer}>{getQuantumDisclosure()}</Text>
          <Text style={styles.bodySpacer}>{getFeeDisclosure()}</Text>
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
});