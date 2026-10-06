import type { SupportedChain } from '../crypto/types';

export type QuantumReadinessLevel = 'CURRENT' | 'WATCH' | 'MIGRATION_REQUIRED';

export type QuantumReadinessReport = {
  chain: SupportedChain;
  level: QuantumReadinessLevel;
  signatureFamily: string;
  publicKeyExposureRelevant: boolean;
  postQuantumNative: boolean;
  migrationReady: boolean;
  warnings: string[];
};

export class QuantumReadinessService {
  static assess(chain: SupportedChain): QuantumReadinessReport {
    const signatureFamily =
      chain === 'SOLANA' || chain === 'STELLAR' || chain === 'ALGORAND'
        ? 'Ed25519'
        : chain === 'XRP'
          ? 'secp256k1/Ed25519'
          : 'secp256k1/ECDSA';

    return {
      chain,
      level: 'WATCH',
      signatureFamily,
      publicKeyExposureRelevant: true,
      postQuantumNative: false,
      migrationReady: false,
      warnings: [
        'This wallet is quantum-aware, not quantum-safe.',
        'Post-quantum migration requires chain-native support and validated signing primitives.',
        'Fresh identities reduce unnecessary exposure but do not make a transparent chain post-quantum safe.',
      ],
    };
  }
}
