import { TransactionSecurityGateService, type TransactionSecurityGateRequest, type TransactionSecurityGateResult } from '../transactions/TransactionSecurityGateService';
import { OutboundSecurityOrchestrator, type OutboundSecurityResult } from '../transactions/OutboundSecurityOrchestrator';
import { SecurityAuditService } from '../transactions/SecurityAuditService';
import { TransactionReviewService, type TransactionReviewSnapshot } from '../transactions/TransactionReviewService';

export type Ron1nSecurityPipelineResult = {
  gate: TransactionSecurityGateResult;
  outbound: OutboundSecurityResult;
  review?: TransactionReviewSnapshot;
};

export class Ron1nSecurityPipeline {
  static async evaluate(
    request: TransactionSecurityGateRequest
  ): Promise<Ron1nSecurityPipelineResult> {
    const gate = await TransactionSecurityGateService.evaluate(request);
    await SecurityAuditService.policyEvaluated(gate.intent, gate.policy);

    const outbound = await OutboundSecurityOrchestrator.evaluate(request);

    if (outbound.status === 'BLOCKED') {
      await SecurityAuditService.blocked(
        gate.intent,
        outbound.reason ?? 'Outbound security orchestration blocked the transaction.'
      );
    }

    return {
      gate,
      outbound,
      review: outbound.status === 'READY'
        ? TransactionReviewService.createSnapshot(gate.intent, gate.policy)
        : undefined,
    };
  }
}
