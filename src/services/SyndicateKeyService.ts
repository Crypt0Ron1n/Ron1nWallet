import * as Crypto from 'expo-crypto';

export class SyndicateKeyService {
  /**
   * Generates a unique Syndicate ID (Syn-ID)
   * Prepend "syn-" to the hashed Quantum Public Key
   */
  static async generateSynID(publicKey: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256, // SHA-256 is the standard starting point
      publicKey
    );
    // Take the first 8 characters of the hash for the ID
    const shortHash = hash.substring(0, 8).toUpperCase();
    return `syn-${shortHash}`;
  }
}