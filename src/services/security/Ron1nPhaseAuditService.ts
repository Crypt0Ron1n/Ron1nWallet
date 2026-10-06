import { ActivityService } from '../transactions/ActivityService';
import { Ron1nRuntimeTestService } from './Ron1nRuntimeTestService';
import { ChainMigrationCapabilityRegistry } from '../migration/ChainMigrationCapabilityRegistry';
import { Ron1nProductionReadinessService } from '../production/Ron1nProductionReadinessService';

export class Ron1nPhaseAuditService {
  static async runAndRecord(): Promise<Awaited<ReturnType<typeof Ron1nProductionReadinessService.evaluate>>> {
    const report = await Ron1nProductionReadinessService.evaluate();

    await ActivityService.addActivity(
      report.productionReady ? 'SECURITY' : 'ERROR',
      report.productionReady
        ? 'Ron1n Security Readiness Passed'
        : 'Ron1n Security Readiness Blocked',
      [
        `Runtime: ${report.runtime.passed} passed / ${report.runtime.failed} failed.`,
        `EVM migration: ${report.ethereumMigrationReady ? 'enabled' : 'blocked'}.`,
        `Migration-ready chains: ${report.fullyMigrationEnabledChains}/${report.supportedChainCount}.`,
      ].join(' ')
    );

    return report;
  }

  static async runRuntimeOnly() {
    return Ron1nRuntimeTestService.run();
  }

  static getMigrationCapabilities() {
    return ChainMigrationCapabilityRegistry.list();
  }
}
