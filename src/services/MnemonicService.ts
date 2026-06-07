import * as Crypto from 'expo-crypto';

const WORDS = [
  'ronin', 'vault', 'quantum', 'shadow', 'cipher', 'signal',
  'blade', 'matrix', 'ghost', 'neon', 'chain', 'node',
  'hash', 'pulse', 'zero', 'orbit', 'secure', 'forge',
  'kernel', 'token', 'alpha', 'delta', 'omega', 'nova'
];

export class MnemonicService {
  static async generate24Words(): Promise<string[]> {
    const randomBytes = await Crypto.getRandomBytesAsync(24);

    return Array.from(randomBytes).map((byte, index) => {
      const wordIndex = byte % WORDS.length;
      return WORDS[wordIndex] + String(index + 1).padStart(2, '0');
    });
  }
}