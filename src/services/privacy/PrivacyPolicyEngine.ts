import type { SupportedChain } from '../crypto/types';

export type PrivacyProtectionMode =
  | 'NONE'
  | 'FRESH_SPEND_IDENTITY'
  | 'PRIVACY_TRANSITION'
  | 'CHAIN_NATIVE_PRIVACY';

export type PrivacyPolicyDecision = {
  mode: PrivacyProtectionMode;
  requiresFreshSpendIdentity: boolean;
  requiresMigration: boolean;
  linkabilityDisclosure: string;
  reasonCodes: readonly string[];
  policyVersion: string;
};

export const PRIVACY_POLICY_VERSION = '1.0.0';

export class PrivacyPolicyEngine {
  static evaluate(
    chain: SupportedChain,
    options: {
      sendingOut: boolean;
      receivingIdentityUsed: boolean;
      maximumPrivacy: boolean;
      privacyTransitionSupported?: boolean;
      chainNativePrivacy?: boolean;
    }
  ): PrivacyPolicyDecision {
    if (!options.sendingOut) {
      return {
        mode: 'NONE',
        requiresFreshSpendIdentity: false,
        requiresMigration: false,
        linkabilityDisclosure:
          'Receiving does not require an automatic on-chain privacy migration.',
        reasonCodes: ['INBOUND_HOLD'],
        policyVersion: PRIVACY_POLICY_VERSION,
      };
    }

    if (options.chainNativePrivacy) {
      return {
        mode: 'CHAIN_NATIVE_PRIVACY',
        requiresFreshSpendIdentity: false,
        requiresMigration: false,
        linkabilityDisclosure:
          `${chain} uses a chain-specific privacy model. Shogun must use its native privacy/key rules rather than assuming transparent-address rotation provides unlinkability.`,
        reasonCodes: ['CHAIN_NATIVE_PRIVACY'],
        policyVersion: PRIVACY_POLICY_VERSION,
      };
    }

    if (options.privacyTransitionSupported) {
      return {
        mode: 'PRIVACY_TRANSITION',
        requiresFreshSpendIdentity: true,
        requiresMigration: true,
        linkabilityDisclosure:
          'A supported privacy transition can provide stronger transaction-linkability protection than ordinary address rotation. The underlying chain may still retain observable information.',
        reasonCodes: [
          'OUTBOUND_PROTECTION',
          'PRIVACY_TRANSITION_AVAILABLE',
        ],
        policyVersion: PRIVACY_POLICY_VERSION,
      };
    }

    return {
      mode: 'FRESH_SPEND_IDENTITY',
      requiresFreshSpendIdentity:
        options.receivingIdentityUsed || options.maximumPrivacy,
      requiresMigration:
        options.receivingIdentityUsed || options.maximumPrivacy,
      linkabilityDisclosure:
        'A fresh address prevents Shogun from reusing the receiving identity for the outbound transaction, but a normal transparent-chain transfer does not erase the public relationship between addresses.',
      reasonCodes: [
        'OUTBOUND_PROTECTION',
        ...(options.receivingIdentityUsed ? ['RECEIVING_IDENTITY_REUSE'] : []),
        ...(options.maximumPrivacy ? ['MAXIMUM_PRIVACY'] : []),
      ],
      policyVersion: PRIVACY_POLICY_VERSION,
    };
  }
}
