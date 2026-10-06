import type { SupportedChain } from '../crypto/types';

export type QuantumRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
export type PublicKeyExposureState =
  | 'NOT_OBSERVED'
  | 'OBSERVED'
  | 'CHAIN_DEPENDENT'
  | 'UNKNOWN';

export type QuantumSecurityAssessment = {
  chain: SupportedChain;
  riskLevel: QuantumRiskLevel;
  publicKeyExposure: PublicKeyExposureState;
  signatureFamily: string;
  postQuantumNative: false;
  migrationReady: boolean;
  requiresFreshIdentityBeforeSpend: boolean;
  warnings: readonly string[];
  assessedAt: string;
};

type ChainQuantumProfile = {
  signatureFamily: string;
  riskLevel: QuantumRiskLevel;
  exposure: PublicKeyExposureState;
  migrationReady: boolean;
};

const PROFILES: Record<SupportedChain, ChainQuantumProfile> = {
  EVM: {
    signatureFamily: 'secp256k1 / ECDSA',
    riskLevel: 'HIGH',
    exposure: 'CHAIN_DEPENDENT',
    migrationReady: false,
  },
  BITCOIN: {
    signatureFamily: 'secp256k1 / ECDSA',
    riskLevel: 'HIGH',
    exposure: 'CHAIN_DEPENDENT',
    migrationReady: false,
  },
  LITECOIN: {
    signatureFamily: 'secp256k1 / ECDSA',
    riskLevel: 'HIGH',
    exposure: 'CHAIN_DEPENDENT',
    migrationReady: false,
  },
  SOLANA: {
    signatureFamily: 'Ed25519',
    riskLevel: 'HIGH',
    exposure: 'CHAIN_DEPENDENT',
    migrationReady: false,
  },
  XRP: {
    signatureFamily: 'secp256k1 / Ed25519',
    riskLevel: 'HIGH',
    exposure: 'CHAIN_DEPENDENT',
    migrationReady: false,
  },
  STELLAR: {
    signatureFamily: 'Ed25519',
    riskLevel: 'HIGH',
    exposure: 'CHAIN_DEPENDENT',
    migrationReady: false,
  },
  ALGORAND: {
    signatureFamily: 'Ed25519',
    riskLevel: 'HIGH',
    exposure: 'CHAIN_DEPENDENT',
    migrationReady: false,
  },
};

export class QuantumSecurityService {
  static assess(chain: SupportedChain): QuantumSecurityAssessment {
    const profile = PROFILES[chain];

    return {
      chain,
      riskLevel: profile.riskLevel,
      publicKeyExposure: profile.exposure,
      signatureFamily: profile.signatureFamily,
      postQuantumNative: false,
      migrationReady: profile.migrationReady,
      requiresFreshIdentityBeforeSpend: true,
      warnings: [
        'The underlying blockchain signature scheme is not post-quantum secure.',
        'A wallet cannot make an unsupported blockchain consensus signature scheme quantum-safe by itself.',
        'Shogun should preserve migration readiness and avoid unnecessary public-key exposure where the chain permits it.',
      ],
      assessedAt: new Date().toISOString(),
    };
  }

  static requiresProtection(
    assessment: QuantumSecurityAssessment
  ): boolean {
    return (
      assessment.riskLevel === 'HIGH' ||
      assessment.publicKeyExposure === 'OBSERVED'
    );
  }
}
