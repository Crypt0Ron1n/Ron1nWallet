import * as SecureStore from 'expo-secure-store';

const MNEMONIC_KEY = 'ron1n_master_mnemonic';
const LEGACY_MNEMONIC_KEY = 'user_mnemonic';
const SYN_ID_KEY = 'ron1n_syn_id';
const LEGACY_SYN_ID_KEY = 'syn_id';

function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The only wallet-vault module permitted to touch expo-secure-store.
 *
 * Application code must not import this module directly. Public callers
 * should use VaultService for write-only vault operations and CryptoCore for
 * cryptographic/recovery operations.
 */
export const InternalVaultService = {
  async saveMnemonic(mnemonic: string): Promise<void> {
    const cleanMnemonic = normalizeMnemonic(mnemonic);

    await SecureStore.setItemAsync(MNEMONIC_KEY, cleanMnemonic, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    // Preserve the legacy key during migration for existing installations.
    await SecureStore.setItemAsync(LEGACY_MNEMONIC_KEY, cleanMnemonic, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getMnemonic(): Promise<string | null> {
    const current = await SecureStore.getItemAsync(MNEMONIC_KEY);
    if (current) return current;

    const legacy = await SecureStore.getItemAsync(LEGACY_MNEMONIC_KEY);
    if (!legacy) return null;

    // Migrate the legacy value without exposing it to application code.
    await SecureStore.setItemAsync(MNEMONIC_KEY, normalizeMnemonic(legacy), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    return legacy;
  },

  async hasVault(): Promise<boolean> {
    const current = await SecureStore.getItemAsync(MNEMONIC_KEY);
    if (current) return true;

    const legacy = await SecureStore.getItemAsync(LEGACY_MNEMONIC_KEY);
    return Boolean(legacy);
  },

  async saveSynId(synId: string): Promise<void> {
    await SecureStore.setItemAsync(SYN_ID_KEY, synId);
    await SecureStore.setItemAsync(LEGACY_SYN_ID_KEY, synId);
  },

  async getSynId(): Promise<string | null> {
    const current = await SecureStore.getItemAsync(SYN_ID_KEY);
    if (current) return current;

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
          // Never include secret values in diagnostics.
          console.warn(`Failed to delete SecureStore key: ${key}`, error);
        }
      })
    );
  },
};
