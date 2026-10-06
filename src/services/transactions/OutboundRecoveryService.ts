import { BroadcastService } from './BroadcastService';
import { ActivityService } from './ActivityService';

export type OutboundRecoveryStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'FAILED'
  | 'RECONCILE_REQUIRED';

export type OutboundRecoveryResult = {
  transactionHash: string;
  status: OutboundRecoveryStatus;
  blockNumber?: number;
  confirmations?: number;
  reason: string;
};

export class OutboundRecoveryService {
  static async reconcile(
    transactionHash: string
  ): Promise<OutboundRecoveryResult> {
    try {
      const result = await BroadcastService.reconcilePersisted(transactionHash);

      if (result.status === 'CONFIRMED') {
        await ActivityService.addActivity(
          'SECURITY',
          'Outbound Reconciled',
          `Transaction ${transactionHash} is confirmed after recovery reconciliation.`
        );
        return {
          transactionHash,
          status: 'CONFIRMED',
          blockNumber: result.blockNumber,
          confirmations: result.confirmations,
          reason: 'Confirmed during reconciliation.',
        };
      }

      if (result.status === 'PENDING') {
        return {
          transactionHash,
          status: 'PENDING',
          blockNumber: result.blockNumber,
          confirmations: result.confirmations,
          reason: 'Transaction remains pending.',
        };
      }

      await ActivityService.addActivity(
        'ERROR',
        'Outbound Reconciliation Failed',
        `Transaction ${transactionHash} was reported failed.`
      );

      return {
        transactionHash,
        status: 'FAILED',
        blockNumber: result.blockNumber,
        confirmations: result.confirmations,
        reason: 'Network reported a failed transaction.',
      };
    } catch (error) {
      await ActivityService.addActivity(
        'ERROR',
        'Outbound Reconciliation Required',
        `Transaction ${transactionHash} requires manual reconciliation.`
      );
      return {
        transactionHash,
        status: 'RECONCILE_REQUIRED',
        reason:
          error instanceof Error
            ? error.message
            : 'Reconciliation failed.',
      };
    }
  }
}
