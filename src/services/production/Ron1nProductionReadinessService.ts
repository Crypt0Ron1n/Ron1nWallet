import { Ron1nRuntimeTestService, type Ron1nRuntimeTestReport } from '../security/Ron1nRuntimeTestService';
import { ChainMigrationCapabilityRegistry } from '../migration/ChainMigrationCapabilityRegistry';
import type { SupportedChain } from '../crypto/types';

export type Ron1nProductionReadinessReport = {
  generatedAt: string;
  runtime: Ron1nRuntimeTestReport;
  allRuntimeTestsPassed: boolean;
  ethereumMigrationReady: boolean;
  supportedChainCount: number;
  fullyMigrationEnabledChains: number;
  partialChains: number;
  productionReady: boolean;
  blockingReasons: string[];
};

export class Ron1nProductionReadinessService {
  static async evaluate(): Promise<Ron1nProductionReadinessReport> {
    const runtime = await Ron1nRuntimeTestService.run();
    const capabilities = ChainMigrationCapabilityRegistry.list();

    const allRuntimeTestsPassed =
      runtime.failed === 0 &&
      runtime.blocked === 0 &&
      runtime.skipped === 0;

    const ethereumMigrationReady =
      ChainMigrationCapabilityRegistry.canExecuteMigration('EVM');

    const partialChains = capabilities.filter((item) => item.status === 'PARTIAL').length;
    const fullyMigrationEnabledChains = capabilities.filter(
      (item) => item.migrationExecution && item.broadcast
    ).length;

    const blockingReasons: string[] = [];

    if (!allRuntimeTestsPassed) {
      blockingReasons.push('Runtime security tests are not all passing.');
    }

    if (!ethereumMigrationReady) {
      blockingReasons.push('EVM native migration execution is not enabled.');
    }

    for (const capability of capabilities) {
      if (capability.status !== 'READY') {
        blockingReasons.push(`${capability.chain}: ${capability.reason}`);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      runtime,
      allRuntimeTestsPassed,
      ethereumMigrationReady,
      supportedChainCount: capabilities.length,
      fullyMigrationEnabledChains,
      partialChains,
      productionReady: allRuntimeTestsPassed && ethereumMigrationReady,
      blockingReasons,
    };
  }

  static async getChainStatus(
    chain: SupportedChain
  ): Promise<ReturnType<typeof ChainMigrationCapabilityRegistry.get>> {
    return ChainMigrationCapabilityRegistry.get(chain);
  }
}
