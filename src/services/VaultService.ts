import * as SecureStore from 'expo-secure-store';

export class VaultService {
  private static KEY = 'syn_id_v1';
  private static MNEMONIC_KEY = 'ron1n_mnemonic_v1';
  static async saveMnemonic(mnemonic: string) {
  await SecureStore.setItemAsync(this.MNEMONIC_KEY, mnemonic, {
    keychainService: 'ron1n',
  });
}
static async getMnemonic() {
  try {
    return await SecureStore.getItemAsync(this.MNEMONIC_KEY, {
      requireAuthentication: true,
      authenticationPrompt: 'Unlock Ron1n Vault',
      keychainService: 'ron1n',
    });
  } catch (e) {
    console.error('Mnemonic Retrieval Error:', e);
    return null;
  }
}

  static async saveIdentity(id: string) {
    await SecureStore.setItemAsync(this.KEY, id, {
      keychainService: 'ron1n',
      requireAuthentication: true
    });
  }

  static async getIdentity() {
    try {
      const result = await SecureStore.getItemAsync(this.KEY, {
        keychainService: 'ron1n',
        requireAuthentication: true,
        authenticationPrompt: 'Unlock Ron1n Vault'
      });

      return result;
    } catch (e) {
      console.error('Vault Retrieval Error:', e);
      return null;
    }
  }
}