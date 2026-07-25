import * as SecureStore from 'expo-secure-store';

const MNEMONIC_KEY = 'ron1n_master_mnemonic';
const LEGACY_MNEMONIC_KEY = 'user_mnemonic';
const SYN_ID_KEY = 'ron1n_syn_id';
const LEGACY_SYN_ID_KEY = 'syn_id';

export const VaultService = {
  async saveMnemonic(mnemonic: string): Promise<void> {
    const cleanMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');

    await SecureStore.setItemAsync(MNEMONIC_KEY, cleanMnemonic, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    // Keep legacy key in sync for older screens/services that may still check it.
    await SecureStore.setItemAsync(LEGACY_MNEMONIC_KEY, cleanMnemonic, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getMnemonic(): Promise<string | null> {
    const current = await SecureStore.getItemAsync(MNEMONIC_KEY);

    if (current) {
      return current;
    }

    const legacy = await SecureStore.getItemAsync(LEGACY_MNEMONIC_KEY);

    if (legacy) {
      // Migrate legacy vault key forward.
      await this.saveMnemonic(legacy);
      return legacy;
    }

    return null;
  },

  async hasVault(): Promise<boolean> {
    const mnemonic = await this.getMnemonic();
    return Boolean(mnemonic);
  },

  async saveSynId(synId: string): Promise<void> {
    await SecureStore.setItemAsync(SYN_ID_KEY, synId);
    await SecureStore.setItemAsync(LEGACY_SYN_ID_KEY, synId);
  },

  async getSynId(): Promise<string | null> {
    const current = await SecureStore.getItemAsync(SYN_ID_KEY);

    if (current) {
      return current;
    }

    return SecureStore.getItemAsync(LEGACY_SYN_ID_KEY);
  },

  async clearVault(): Promise<void> {
    const keys = [
      MNEMONIC_KEY,
      LEGACY_MNEMONIC_KEY,
      SYN_ID_KEY,
      LEGACY_SYN_ID_KEY,
    ];

    await Promise.all(
      keys.map(async (key) => {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (error) {
          console.warn(`Failed to delete SecureStore key: ${key}`, error);
        }
      })
    );
  },
};