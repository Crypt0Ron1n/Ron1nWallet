import { ChainMigrationCapabilityRegistry, type ChainMigrationCapability } from './ChainMigrationCapabilityRegistry';
import type { SupportedChain } from '../crypto/types';

export type Phase9MigrationValidation = {
  status: 'PASS' | 'WARN';
  ethereum: ChainMigrationCapability;
  capabilities: ChainMigrationCapability[];
  checkedAt: string;
  detail: string;
};

export class Ron1nPhase9MigrationValidationService {
  static run(): Phase9MigrationValidation {
    const capabilities = ChainMigrationCapabilityRegistry.list();
    const ethereum = ChainMigrationCapabilityRegistry.get('EVM' as SupportedChain);
    return {
      status: ethereum.status === 'READY' ? 'PASS' : 'WARN',
      ethereum,
      capabilities,
      checkedAt: new Date().toISOString(),
      detail: ethereum.status === 'READY'
        ? 'EVM migration capability is registered as execution-ready; unsupported chains remain gated.'
        : 'EVM migration capability is not execution-ready.'
    };
  }
}
