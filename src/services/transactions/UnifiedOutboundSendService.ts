import { OutboundTransactionExecutionService, type OutboundExecutionResult } from './OutboundTransactionExecutionService';
import type { TransactionIntent } from './TransactionIntent';
import type { SecurityPolicyResult } from '../SecurityPolicyEngine';

export type UnifiedOutboundSendRequest = {
  intent: TransactionIntent;
  policy: SecurityPolicyResult;
  derivationIndex: number;
};

/**
 * Phase 13: the single application-facing outbound execution boundary.
 *
 * UI code may prepare/review an intent, but final execution must enter here.
 * This service deliberately does not handle secrets and does not perform
 * migration itself; callers must complete required protection before calling it.
 */
export class UnifiedOutboundSendService {
  static async execute(
    request: UnifiedOutboundSendRequest
  ): Promise<OutboundExecutionResult> {
    return OutboundTransactionExecutionService.execute({
      intent: request.intent,
      policy: request.policy,
      derivationRef: { index: request.derivationIndex },
    });
  }
}