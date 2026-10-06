import { ActivityService } from '../transactions/ActivityService';
import { Ron1nPhase7RuntimeValidationService } from '../security/Ron1nPhase7RuntimeValidationService';
import { Ron1nPhase8IdentityExposureValidationService } from '../security/Ron1nPhase8IdentityExposureValidationService';
import { Ron1nPhase9MigrationValidationService } from '../migration/Ron1nPhase9MigrationValidationService';
import { Ron1nPhase10OutboundPipelineValidationService } from '../transactions/Ron1nPhase10OutboundPipelineValidationService';
import { Ron1nPhase11RecoveryAuditValidationService } from '../migration/Ron1nPhase11RecoveryAuditValidationService';

export class Ron1nPhase12ProductionHardeningService {
  static async run() {
    const phase7 = await Ron1nPhase7RuntimeValidationService.run();
    const phase8 = await Ron1nPhase8IdentityExposureValidationService.run();
    const phase9 = Ron1nPhase9MigrationValidationService.run();
    const phase10 = Ron1nPhase10OutboundPipelineValidationService.run();
    const phase11 = await Ron1nPhase11RecoveryAuditValidationService.run();

    const blockingReasons: string[] = [];
    if (phase7.status !== 'PASS') blockingReasons.push('Phase 7 runtime invariant tests failed.');
    if (phase9.status !== 'PASS') blockingReasons.push('EVM migration capability is not ready.');
    if (phase10.status !== 'PASS') blockingReasons.push('Outbound fail-closed validation failed.');

    const status = blockingReasons.length === 0 ? 'READY_FOR_DEVICE_VALIDATION' : 'BLOCKED';

    try {
      await ActivityService.addActivity(
        status === 'READY_FOR_DEVICE_VALIDATION' ? 'SECURITY' : 'ERROR',
        'Ron1n Phases 7-12 Validation',
        status === 'READY_FOR_DEVICE_VALIDATION'
          ? 'Code-side validation passed. Live device, biometric, RPC, migration, broadcast, reconciliation and restart testing remain required.'
          : blockingReasons.join(' ')
      );
    } catch {}

    return { status, phase7, phase8, phase9, phase10, phase11, blockingReasons, checkedAt: new Date().toISOString() };
  }
}
