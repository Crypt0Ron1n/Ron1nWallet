import type { SupportedChain } from '../crypto/types';
import type { PrivacyStrategy } from './PrivacyTypes';
import { EvmPrivacyStrategy } from './EvmPrivacyStrategy';
import { UnimplementedPrivacyStrategy } from './UnimplementedPrivacyStrategy';

const evmPrivacyStrategy = new EvmPrivacyStrategy();

/**
 * Chain-agnostic lookup, mirroring ChainAdapterFactory/ProviderFactory's
 * switch-based dispatch rather than a mutable registration map.
 */
export class PrivacyStrategyRegistry {
  static get(chain: SupportedChain): PrivacyStrategy {
    switch (chain) {
      case 'EVM':
        return evmPrivacyStrategy;
      default:
        return new UnimplementedPrivacyStrategy(chain);
    }
  }
}
