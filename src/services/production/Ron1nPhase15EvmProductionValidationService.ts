import { ProviderFactory } from '../providers/ProviderFactory';
import { NetworkStateService } from '../network/NetworkStateService';

export type Phase15EvmProductionValidation = {
  status: 'PASS' | 'FAIL';
  providerConnected: boolean;
  providerMode: string;
  chainId?: number;
  reason: string;
  checkedAt: string;
};

/**
 * Phase 15: validates that the configured ETH provider can expose production
 * network state. It does not send funds and never treats MOCK as production.
 */
export class Ron1nPhase15EvmProductionValidationService {
  static async run(): Promise<Phase15EvmProductionValidation> {
    try {
      const provider = ProviderFactory.getProvider('ETH');
      const providerStatus = await provider.getStatus();

      if (!providerStatus.connected || providerStatus.mode !== 'RPC') {
        return {
          status: 'FAIL',
          providerConnected: providerStatus.connected,
          providerMode: providerStatus.mode,
          reason: 'ETH provider is not connected in RPC mode.',
          checkedAt: new Date().toISOString(),
        };
      }

      const network = await NetworkStateService.resolve({
        chain: 'EVM',
        network: 'Ethereum Mainnet',
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
      });

      const ready = network.status === 'READY' && network.chainId === 1;

      return {
        status: ready ? 'PASS' : 'FAIL',
        providerConnected: providerStatus.connected,
        providerMode: providerStatus.mode,
        chainId: network.chainId,
        reason: ready
          ? 'Ethereum Mainnet RPC and network-state validation passed.'
          : `Ethereum network state is not production-ready: ${network.warnings.join('; ')}`,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'FAIL',
        providerConnected: false,
        providerMode: 'UNKNOWN',
        reason: error instanceof Error ? error.message : 'ETH production validation failed.',
        checkedAt: new Date().toISOString(),
      };
    }
  }
}