import type { SupportedChain } from '../crypto/types';

export type PrivacyTransitionMode =
  | 'NONE'
  | 'FRESH_SPEND_IDENTITY'
  | 'PRIVACY_TRANSITION'
  | 'CHAIN_NATIVE_PRIVACY';

export type PrivacyTransitionResult = {
  allowed: boolean;
  mode: PrivacyTransitionMode;
  sourceAddress: string;
  destinationAddress?: string;
  reason: string;
  provenancePreserved: boolean;
};

export class PrivacyTransitionService {
  static assess(
    chain: SupportedChain,
    sourceAddress: string,
    destinationAddress?: string
  ): PrivacyTransitionResult {
    const nativePrivacy = chain === 'BITCOIN'
      ? false
      : chain === 'LITECOIN'
        ? false
        : chain === 'XRP'
          ? false
          : chain === 'STELLAR'
            ? false
            : chain === 'ALGORAND'
              ? false
              : chain === 'SOLANA'
                ? false
                : false;

    if (!sourceAddress) {
      return {
        allowed: false,
        mode: 'NONE',
        sourceAddress,
        reason: 'A source identity is required.',
        provenancePreserved: true,
      };
    }

    if (nativePrivacy) {
      return {
        allowed: true,
        mode: 'CHAIN_NATIVE_PRIVACY',
        sourceAddress,
        destinationAddress,
        reason: 'Chain-native privacy handling applies.',
        provenancePreserved: false,
      };
    }

    if (destinationAddress && destinationAddress !== sourceAddress) {
      return {
        allowed: true,
        mode: 'FRESH_SPEND_IDENTITY',
        sourceAddress,
        destinationAddress,
        reason: 'A fresh identity can improve address hygiene, but transparent-chain provenance remains observable.',
        provenancePreserved: true,
      };
    }

    return {
      allowed: true,
      mode: 'NONE',
      sourceAddress,
      reason: 'No privacy transition requested.',
      provenancePreserved: true,
    };
  }
}
