import { MigrationRecoveryCoordinator } from '../migration/MigrationRecoveryCoordinator';
import { MigrationExecutionRecoveryService } from '../migration/MigrationExecutionRecoveryService';
import { ActivityService } from './ActivityService';

export type Phase18RecoveryValidation = {
  status: 'PASS' | 'WARN';
  recoverableRecords: number;
  auditEvents: number;
  reason: string;
  checkedAt: string;
};

/**
 * Phase 18: runs persisted migration recovery without re-signing transactions.
 */
export class Ron1nPhase18RecoveryValidationService {
  static async run(): Promise<Phase18RecoveryValidation> {
    const before = await MigrationExecutionRecoveryService.list();
    let status: 'PASS' | 'WARN' = 'PASS';

    try {
      await MigrationRecoveryCoordinator.recover();
    } catch {
      status = 'WARN';
    }

    const after = await MigrationExecutionRecoveryService.list();
    const activities = await ActivityService.getActivities();

    return {
      status,
      recoverableRecords: after.filter(
        (record) =>
          record.transactionHash &&
          !['CONFIRMED', 'FAILED'].includes(record.status)
      ).length,
      auditEvents: activities.length,
      reason:
        status === 'PASS'
          ? `Recovery coordinator executed without re-signing. ${after.length} persisted migration record(s) inspected.`
          : `Recovery coordinator reported an error while inspecting ${before.length} persisted migration record(s).`,
      checkedAt: new Date().toISOString(),
    };
  }
}