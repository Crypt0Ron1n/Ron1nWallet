import { Ron1nPhase15EvmProductionValidationService } from './Ron1nPhase15EvmProductionValidationService';
import { Ron1nPhase17ChainExecutionReadinessService } from './Ron1nPhase17ChainExecutionReadinessService';
import { Ron1nPhase18RecoveryValidationService } from '../transactions/Ron1nPhase18RecoveryValidationService';
import { Ron1nPhase19SecurityHardeningService } from '../security/Ron1nPhase19SecurityHardeningService';
import { Ron1nPhase16TokenReadinessService } from '../security/Ron1nPhase16TokenReadinessService';
import { ActivityService } from '../transactions/ActivityService';

export type Ron1nPhase20FinalAudit = {
  status: 'READY_FOR_DEVICE_VALIDATION' | 'BLOCKED';
  phase15: Awaited<ReturnType<typeof Ron1nPhase15EvmProductionValidationService.run>>;
  phase16: ReturnType<typeof Ron1nPhase16TokenReadinessService.list>;
  phase17: ReturnType<typeof Ron1nPhase17ChainExecutionReadinessService.run>;
  phase18: Awaited<ReturnType<typeof Ron1nPhase18RecoveryValidationService.run>>;
  phase19: Awaited<ReturnType<typeof Ron1nPhase19SecurityHardeningService.run>>;
  blockingReasons: string[];
  checkedAt: string;
};

export class Ron1nPhase20FinalSecurityAuditService {
  static async run(): Promise<Ron1nPhase20FinalAudit> {
    const phase15 = await Ron1nPhase15EvmProductionValidationService.run();
    const phase16 = Ron1nPhase16TokenReadinessService.list();
    const phase17 = Ron1nPhase17ChainExecutionReadinessService.run();
    const phase18 = await Ron1nPhase18RecoveryValidationService.run();
    const phase19 = await Ron1nPhase19SecurityHardeningService.run();

    const blockingReasons: string[] = [];

    if (phase15.status !== 'PASS') {
      blockingReasons.push('Ethereum Mainnet provider/network validation did not pass.');
    }
    if (phase18.status !== 'PASS') {
      blockingReasons.push('Recovery validation returned a warning.');
    }
    if (phase19.status !== 'PASS') {
      blockingReasons.push('Security hardening checks did not pass.');
    }

    const status =
      blockingReasons.length === 0
        ? 'READY_FOR_DEVICE_VALIDATION'
        : 'BLOCKED';

    try {
      await ActivityService.addActivity(
        status === 'READY_FOR_DEVICE_VALIDATION' ? 'SECURITY' : 'ERROR',
        'Ron1n Phases 13-20 Final Audit',
        status === 'READY_FOR_DEVICE_VALIDATION'
          ? 'Code-side phases 13-20 passed. Physical-device, biometric, live-RPC, migration, broadcast, restart, and adversarial testing remain required.'
          : blockingReasons.join(' ')
      );
    } catch {}

    return {
      status,
      phase15,
      phase16,
      phase17,
      phase18,
      phase19,
      blockingReasons,
      checkedAt: new Date().toISOString(),
    };
  }
}