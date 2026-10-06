import { ActivityService } from '../transactions/ActivityService';
import { IdentityRegistryService } from '../identity/IdentityRegistryService';
import { MigrationExecutionRecoveryService } from './MigrationExecutionRecoveryService';

export type MigrationLifecycleFinalizationResult =
  | {
      status: 'FINALIZED';
      reason: string;
    }
  | {
      status: 'ALREADY_FINALIZED';
      reason: string;
    }
  | {
      status: 'BLOCKED';
      reason: string;
    };

export class MigrationIdentityLifecycleService {
  /**
   * Finalizes identity lifecycle only after chain confirmation has already
   * been established by the broadcast/reconciliation layer.
   *
   * This service is deliberately idempotent:
   * ACTIVE + RETIRED is the only valid completed state.
   * It never retires an ACTIVE source before the destination is ACTIVE.
   */
  static async finalizeConfirmedMigration(
    intentId: string,
    transactionHash: string
  ): Promise<MigrationLifecycleFinalizationResult> {
    const recovery = await MigrationExecutionRecoveryService.get(intentId);

    if (!recovery) {
      return {
        status: 'BLOCKED',
        reason: 'Migration recovery record was not found.',
      };
    }

    if (
      recovery.transactionHash &&
      recovery.transactionHash.toLowerCase() !== transactionHash.toLowerCase()
    ) {
      return {
        status: 'BLOCKED',
        reason: 'Confirmed transaction hash does not match the recorded migration.',
      };
    }

    const source = await IdentityRegistryService.get(
      recovery.sourceIdentityId
    );
    const destination = await IdentityRegistryService.get(
      recovery.destinationIdentityId
    );

    if (!source || !destination) {
      return {
        status: 'BLOCKED',
        reason: 'Migration identities could not be resolved.',
      };
    }

    if (source.accountId !== recovery.accountId || destination.accountId !== recovery.accountId) {
      return {
        status: 'BLOCKED',
        reason: 'Migration identity ownership does not match the recovery record.',
      };
    }

    if (source.chain !== destination.chain) {
      return {
        status: 'BLOCKED',
        reason: 'Migration identities belong to different chains.',
      };
    }

    if (destination.lifecycle === 'ACTIVE' && source.lifecycle === 'RETIRED') {
      await MigrationExecutionRecoveryService.mark(
        intentId,
        'CONFIRMED',
        transactionHash
      );

      return {
        status: 'ALREADY_FINALIZED',
        reason: 'Migration lifecycle was already finalized.',
      };
    }

    if (destination.lifecycle !== 'RESERVED' && destination.lifecycle !== 'ACTIVE') {
      return {
        status: 'BLOCKED',
        reason: 'Destination identity is not in a safe RESERVED/ACTIVE lifecycle state.',
      };
    }

    if (source.lifecycle !== 'ACTIVE' && source.lifecycle !== 'RETIRED') {
      return {
        status: 'BLOCKED',
        reason: 'Source identity is not in a safe ACTIVE/RETIRED lifecycle state.',
      };
    }

    /*
     * Activate destination first. The old source is never retired unless the
     * new identity is confirmed ACTIVE.
     */
    if (destination.lifecycle === 'RESERVED') {
      const activated = await IdentityRegistryService.activate(
        destination.identityId
      );

      if (!activated) {
        return {
          status: 'BLOCKED',
          reason: 'Destination identity could not be activated.',
        };
      }
    }

    const activeDestination = await IdentityRegistryService.get(
      destination.identityId
    );

    if (!activeDestination || activeDestination.lifecycle !== 'ACTIVE') {
      return {
        status: 'BLOCKED',
        reason: 'Destination identity did not reach ACTIVE state.',
      };
    }

    if (source.lifecycle === 'ACTIVE') {
      const retired = await IdentityRegistryService.retire(source.identityId);

      if (!retired) {
        await ActivityService.addActivity(
          'ERROR',
          'Migration Lifecycle Reconciliation Required',
          `Migration ${transactionHash} confirmed, destination ${activeDestination.address} is active, but source ${source.address} could not be retired automatically.`
        );

        return {
          status: 'BLOCKED',
          reason:
            'Destination is active, but source retirement failed. Manual lifecycle reconciliation is required; the source remains protected from automatic reuse.',
        };
      }
    }

    const finalSource = await IdentityRegistryService.get(source.identityId);

    if (!finalSource || finalSource.lifecycle !== 'RETIRED') {
      return {
        status: 'BLOCKED',
        reason: 'Source identity did not reach RETIRED state.',
      };
    }

    await MigrationExecutionRecoveryService.mark(
      intentId,
      'CONFIRMED',
      transactionHash
    );

    await ActivityService.addActivity(
      'SECURITY',
      'Migration Identity Lifecycle Finalized',
      `Migration ${transactionHash} finalized: destination ${activeDestination.address} is active and source ${finalSource.address} is retired.`
    );

    return {
      status: 'FINALIZED',
      reason: 'Confirmed migration lifecycle was finalized safely.',
    };
  }
}
