import type { SupportedChain } from '../crypto/types';
import type { PrivacyCapabilities, PrivacyStrategy } from './PrivacyTypes';

/**
 * Honest fallback for any chain without a real privacy capability model yet.
 * Every capability reports NOT_IMPLEMENTED rather than guessing - this is
 * what backs "unknown/unimplemented capability" chains (and every
 * currently-supported non-EVM chain, until each gets its own strategy).
 */
export class UnimplementedPrivacyStrategy implements PrivacyStrategy {
  constructor(readonly chain: SupportedChain) {}

  getCapabilities(): PrivacyCapabilities {
    const notImplemented = {
      availability: 'NOT_IMPLEMENTED' as const,
      explanation: `No privacy capability model has been implemented for ${this.chain} yet.`,
    };

    return {
      chain: this.chain,
      capabilities: {
        ADDRESS_SEPARATION: notImplemented,
        IDENTITY_SEPARATION: notImplemented,
        PRIVACY_ROUTE: notImplemented,
        UNLINKABILITY: notImplemented,
        NATIVE_PROTOCOL_PRIVACY: notImplemented,
      },
    };
  }
}
