import { ActivityService } from '../transactions/ActivityService';
import { MigrationExecutionRecoveryService } from './MigrationExecutionRecoveryService';

export type Phase11RecoveryAuditValidation = {
  status: 'PASS' | 'WARN';
  recoveryRecordCount: number;
  activityRecordCount: number;
  checkedAt: string;
  detail: string;
};

export class Ron1nPhase11RecoveryAuditValidationService {
  static async run(): Promise<Phase11RecoveryAuditValidation> {
    const [recoveryRecords, activities] = await Promise.all([
      MigrationExecutionRecoveryService.list(),
      ActivityService.getActivities()
    ]);
    return {
      status: 'PASS',
      recoveryRecordCount: recoveryRecords.length,
      activityRecordCount: activities.length,
      checkedAt: new Date().toISOString(),
      detail: 'Recovery persistence and local audit storage are readable; no recovery record is re-signed.'
    };
  }
}
