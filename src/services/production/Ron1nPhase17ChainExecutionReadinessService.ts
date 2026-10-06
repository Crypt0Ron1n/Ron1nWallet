import {
  ChainMigrationCapabilityRegistry,
  type ChainMigrationCapability,
} from '../migration/ChainMigrationCapabilityRegistry';

export type Phase17ChainExecutionReadiness = {
  ready: ChainMigrationCapability[];
  partial: ChainMigrationCapability[];
  blocked: ChainMigrationCapability[];
  checkedAt: string;
};

/**
 * Phase 17: exposes the real chain capability boundary to the rest of the app.
 * No chain is promoted to production execution by this service.
 */
export class Ron1nPhase17ChainExecutionReadinessService {
  static run(): Phase17ChainExecutionReadiness {
    const capabilities = ChainMigrationCapabilityRegistry.list();

    return {
      ready: capabilities.filter((item) => item.status === 'READY'),
      partial: capabilities.filter((item) => item.status === 'PARTIAL'),
      blocked: capabilities.filter((item) => item.status === 'BLOCKED'),
      checkedAt: new Date().toISOString(),
    };
  }
}