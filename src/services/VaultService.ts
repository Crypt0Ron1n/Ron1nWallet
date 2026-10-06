import { InternalVaultService } from './crypto/InternalVaultService';

/**
 * Public application-facing vault adapter.
 *
 * Secret material is physically stored and retrieved by InternalVaultService.
 * getMnemonic() is retained temporarily for compatibility with existing
 * App.tsx and SettingsScreen.tsx callers. New cryptographic code should use
 * CryptoCore instead of retrieving the mnemonic directly.
 */
export const VaultService = {
  async saveMnemonic(mnemonic: string): Promise<void> {
    return InternalVaultService.saveMnemonic(mnemonic);
  },

  /**
   * @deprecated Compatibility API for existing legacy screens.
   * Do not use this for signing, address derivation, transaction creation,
   * or other cryptographic operations. Those operations belong in CryptoCore.
   */
  async getMnemonic(): Promise<string | null> {
    return InternalVaultService.getMnemonic();
  },

  async hasVault(): Promise<boolean> {
    return InternalVaultService.hasVault();
  },

  async saveSynId(synId: string): Promise<void> {
    return InternalVaultService.saveSynId(synId);
  },

  async getSynId(): Promise<string | null> {
    return InternalVaultService.getSynId();
  },

  async clearVault(): Promise<void> {
    return InternalVaultService.clearVault();
  },
};
