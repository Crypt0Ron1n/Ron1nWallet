import { ProviderFactory } from '../providers/ProviderFactory';
import { BroadcastService } from '../transactions/BroadcastService';
import { ActivityService } from '../transactions/ActivityService';
import { MigrationExecutionRecoveryService } from './MigrationExecutionRecoveryService';
import { MigrationIdentityLifecycleService } from './MigrationIdentityLifecycleService';

export type MigrationRecoveryRunResult = {
  scanned: number;
  reconciled: number;
  pending: number;
  confirmed: number;
  failed: number;
  blocked: number;
};

export class MigrationRecoveryCoordinator {
  /**
   * App-start / resume recovery boundary.
   *
   * It only reconciles transactions already known to Ron1n. It never creates
   * a new transaction, signs a replacement, or changes identity lifecycle
   * before chain confirmation.
   */
  static async recover(): Promise<MigrationRecoveryRunResult> {
    const records = await MigrationExecutionRecoveryService.list();

    const result: MigrationRecoveryRunResult = {
      scanned: records.length,
      reconciled: 0,
      pending: 0,
      confirmed: 0,
      failed: 0,
      blocked: 0,
    };

    for (const record of records) {
      if (!record.transactionHash) {
        continue;
      }

      if (record.status === 'CONFIRMED' || record.status === 'FAILED') {
        continue;
      }

      try {
        const lifecycle = await BroadcastService.reconcilePersisted(
          record.transactionHash
        );

        result.reconciled += 1;

        if (lifecycle.status === 'CONFIRMED') {
          await MigrationExecutionRecoveryService.mark(
            record.intentId,
            'CONFIRMED',
            record.transactionHash
          );

          const finalized =
            await MigrationIdentityLifecycleService.finalizeConfirmedMigration(
              record.intentId,
              record.transactionHash
            );

          if (
            finalized.status === 'FINALIZED' ||
            finalized.status === 'ALREADY_FINALIZED'
          ) {
            result.confirmed += 1;
          } else {
            result.blocked += 1;
          }
        } else if (lifecycle.status === 'PENDING') {
          await MigrationExecutionRecoveryService.mark(
            record.intentId,
            'PENDING',
            record.transactionHash
          );
          result.pending += 1;
        } else {
          await MigrationExecutionRecoveryService.mark(
            record.intentId,
            'FAILED',
            record.transactionHash
          );
          result.failed += 1;
        }
      } catch (error) {
        await MigrationExecutionRecoveryService.mark(
          record.intentId,
          'RECONCILE_REQUIRED',
          record.transactionHash
        );

        result.blocked += 1;

        await ActivityService.addActivity(
          'ERROR',
          'Migration Recovery Required',
          error instanceof Error
            ? `Migration ${record.transactionHash} could not be reconciled automatically: ${error.message}`
            : `Migration ${record.transactionHash} could not be reconciled automatically.`
        );
      }
    }

    return result;
  }
}
