import { EvmProtectBeforeSendService } from './EvmProtectBeforeSendService';
import { EvmProtectBeforeSendExecutionService } from './EvmProtectBeforeSendExecutionService';
import { ProtectBeforeSendService, type ProtectBeforeSendAssessment } from './ProtectBeforeSendService';
import type { SecurityProfile, TransactionIntent } from '../transactions/TransactionIntent';

export type ProtectBeforeSendWorkflowResult =
  | {
      status: 'NOT_REQUIRED';
      assessment: ProtectBeforeSendAssessment;
      reason: string;
    }
  | {
      status: 'CONFIRMED';
      assessment: ProtectBeforeSendAssessment;
      reason: string;
      spendAddress: string;
      spendIndex: number;
      transactionHash?: string;
    }
  | {
      status: 'PENDING' | 'BLOCKED' | 'FAILED';
      assessment: ProtectBeforeSendAssessment;
      reason: string;
      spendAddress?: string;
      spendIndex?: number;
      transactionHash?: string;
    };

/**
 * Phase 14: centralizes Protect Before Send UX orchestration.
 * Native ETH/EVM is the only production migration executor currently enabled.
 */
export class ProtectBeforeSendWorkflowService {
  static async executeIfRequired(
    intent: TransactionIntent,
    securityProfile: SecurityProfile
  ): Promise<ProtectBeforeSendWorkflowResult> {
    const assessment = await ProtectBeforeSendService.assess(
      intent.accountId,
      intent.asset.chain,
      intent.from
    );

    const required =
      assessment.status === 'REQUIRED' ||
      assessment.status === 'UNREGISTERED';

    if (!required) {
      if (assessment.status === 'BLOCKED') {
        return { status: 'BLOCKED', assessment, reason: assessment.reason };
      }

      return {
        status: 'NOT_REQUIRED',
        assessment,
        reason: 'An active SPEND identity is already available.',
      };
    }

    if (intent.asset.chain !== 'EVM' || intent.asset.symbol.toUpperCase() !== 'ETH') {
      return {
        status: 'BLOCKED',
        assessment,
        reason:
          'Protect Before Send is required, but the selected chain/asset does not have a production migration executor enabled.',
      };
    }

    const plan = await EvmProtectBeforeSendService.prepareMigration(
      intent.accountId,
      intent.from,
      intent.asset.network,
      securityProfile,
      intent.amount,
      intent.sendMode
    );

    if (plan.status !== 'READY') {
      return {
        status: 'BLOCKED',
        assessment,
        reason: plan.reason,
      };
    }

    const execution = await EvmProtectBeforeSendExecutionService.execute(plan);

    if (execution.status === 'CONFIRMED' && execution.spendIdentity) {
      return {
        status: 'CONFIRMED',
        assessment,
        reason: execution.reason,
        spendAddress: execution.spendIdentity.address,
        spendIndex: execution.spendIdentity.index,
        transactionHash: execution.transactionHash,
      };
    }

    if (execution.status === 'CONFIRMED') {
      if (!execution.spendIdentity) {
        return {
          status: 'FAILED',
          assessment,
          reason: 'Migration reported CONFIRMED but no SPEND identity was returned.',
          ...(execution.transactionHash
            ? { transactionHash: execution.transactionHash }
            : {}),
        };
      }

      return {
        status: 'CONFIRMED',
        assessment,
        reason: execution.reason,
        spendAddress: execution.spendIdentity.address,
        spendIndex: execution.spendIdentity.index,
        ...(execution.transactionHash
          ? { transactionHash: execution.transactionHash }
          : {}),
      };
    }

    return {
      status: execution.status,
      assessment,
      reason: execution.reason,
      ...(execution.spendIdentity
        ? {
            spendAddress: execution.spendIdentity.address,
            spendIndex: execution.spendIdentity.index,
          }
        : {}),
      ...(execution.transactionHash
        ? { transactionHash: execution.transactionHash }
        : {}),
    };
  }
}