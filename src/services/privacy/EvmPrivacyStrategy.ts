import type { PrivacyCapabilities, PrivacyStrategy } from './PrivacyTypes';

/**
 * Ethereum capability reporting only - no mixer, privacy pool, ZK transfer,
 * or stealth-address execution exists here or anywhere else in the app yet.
 *
 * Truthful baseline: Ethereum is a transparent ledger. Address/identity
 * separation is real and available (Shogun can register a fresh identity),
 * but that does not make a transfer unlinkable, and no privacy protocol is
 * integrated to change that.
 */
export class EvmPrivacyStrategy implements PrivacyStrategy {
  readonly chain = 'EVM' as const;

  getCapabilities(): PrivacyCapabilities {
    return {
      chain: 'EVM',
      capabilities: {
        ADDRESS_SEPARATION: {
          availability: 'AVAILABLE',
          explanation:
            'Shogun can derive and register a fresh EVM address for this account.',
        },
        IDENTITY_SEPARATION: {
          availability: 'AVAILABLE',
          explanation:
            'Shogun can track a fresh address as a separate holding identity, distinct from the original receive identity.',
        },
        PRIVACY_ROUTE: {
          availability: 'NOT_IMPLEMENTED',
          explanation:
            'No Ethereum privacy protocol (mixer, privacy pool, or shielded route) is currently integrated.',
        },
        UNLINKABILITY: {
          availability: 'UNAVAILABLE',
          explanation:
            'Ethereum is a transparent ledger. An ordinary transfer between two addresses remains permanently publicly linkable.',
        },
        NATIVE_PROTOCOL_PRIVACY: {
          availability: 'UNAVAILABLE',
          explanation:
            'Ethereum has no native protocol-level privacy comparable to Monero or shielded Zcash.',
        },
      },
    };
  }
}
