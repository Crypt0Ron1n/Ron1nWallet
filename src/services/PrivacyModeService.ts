import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIVACY_MODE_KEY = 'shogun_privacy_mode_enabled_v1';

export class PrivacyModeService {
  static async isEnabled(): Promise<boolean> {
    const stored = await AsyncStorage.getItem(PRIVACY_MODE_KEY);

    if (stored === null) {
      return true;
    }

    return stored === 'true';
  }

  static async setEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(PRIVACY_MODE_KEY, enabled ? 'true' : 'false');
  }

  static async requireUserSyncConsent(): Promise<boolean> {
    return this.isEnabled();
  }

  static getPrivacyModeText() {
    return {
      title: 'Privacy Mode Active',
      body:
        'Shogun Wallet does not automatically fetch public-chain data. Balances, transaction history, and exposure scans run only when you choose to sync or scan.',
    };
  }
}