import type { SupportedChain } from '../crypto/types';

export type ChainMigrationCapability = {
  chain: SupportedChain;
  receive: boolean;
  activity: boolean;
  migrationPlanning: boolean;
  migrationExecution: boolean;
  broadcast: boolean;
  reconciliation: boolean;
  status: 'READY' | 'PARTIAL' | 'BLOCKED';
  reason: string;
};

const capabilities: Record<SupportedChain, ChainMigrationCapability> = {
  EVM: {
    chain: 'EVM',
    receive: true,
    activity: true,
    migrationPlanning: true,
    migrationExecution: true,
    broadcast: true,
    reconciliation: true,
    status: 'READY',
    reason: 'Native ETH Protect Before Send execution is implemented and wired through policy, signing, broadcast, and reconciliation boundaries.',
  },
  SOLANA: {
    chain: 'SOLANA',
    receive: true,
    activity: true,
    migrationPlanning: false,
    migrationExecution: false,
    broadcast: false,
    reconciliation: true,
    status: 'PARTIAL',
    reason: 'Receiving/activity infrastructure exists, but production migration and signing remain disabled pending independently validated Solana derivation and serialization.',
  },
  BITCOIN: {
    chain: 'BITCOIN',
    receive: true,
    activity: true,
    migrationPlanning: false,
    migrationExecution: false,
    broadcast: false,
    reconciliation: true,
    status: 'PARTIAL',
    reason: 'UTXO infrastructure exists, but production migration execution remains disabled pending full UTXO construction/signing validation.',
  },
  LITECOIN: {
    chain: 'LITECOIN',
    receive: true,
    activity: true,
    migrationPlanning: false,
    migrationExecution: false,
    broadcast: false,
    reconciliation: true,
    status: 'PARTIAL',
    reason: 'UTXO infrastructure exists, but production migration execution remains disabled pending full Litecoin construction/signing validation.',
  },
  XRP: {
    chain: 'XRP',
    receive: true,
    activity: true,
    migrationPlanning: false,
    migrationExecution: false,
    broadcast: false,
    reconciliation: true,
    status: 'PARTIAL',
    reason: 'XRP activity/receive infrastructure exists, but production migration remains blocked pending derivation interoperability and transaction validation.',
  },
  STELLAR: {
    chain: 'STELLAR',
    receive: true,
    activity: true,
    migrationPlanning: false,
    migrationExecution: false,
    broadcast: false,
    reconciliation: true,
    status: 'PARTIAL',
    reason: 'Stellar receive/activity infrastructure exists, but production migration execution remains disabled pending full signing and reconciliation validation.',
  },
  ALGORAND: {
    chain: 'ALGORAND',
    receive: true,
    activity: true,
    migrationPlanning: false,
    migrationExecution: false,
    broadcast: false,
    reconciliation: true,
    status: 'PARTIAL',
    reason: 'Algorand receive/activity infrastructure exists, but production migration execution remains disabled pending full transaction/signing validation.',
  },
};

export class ChainMigrationCapabilityRegistry {
  static get(chain: SupportedChain): ChainMigrationCapability {
    return capabilities[chain];
  }

  static list(): ChainMigrationCapability[] {
    return Object.values(capabilities);
  }

  static canExecuteMigration(chain: SupportedChain): boolean {
    return capabilities[chain].migrationExecution;
  }

  static assertExecutionEnabled(chain: SupportedChain): void {
    const capability = capabilities[chain];

    if (!capability.migrationExecution) {
      throw new Error(`${chain} migration execution is blocked: ${capability.reason}`);
    }
  }
}
