import type { SecurityPolicyResult } from '../SecurityPolicyEngine';
import { ProtectBeforeSendService } from '../security/ProtectBeforeSendService';
import {
  TransactionSecurityGateService,
  type TransactionSecurityGateRequest,
  type TransactionSecurityGateResult,
} from './TransactionSecurityGateService';

export type OutboundSecurityStatus =
  | 'READY'
  | 'PROTECTION_REQUIRED'
  | 'BLOCKED';

export type OutboundSecurityResult = {
  status: OutboundSecurityStatus;
  gate: TransactionSecurityGateResult;
  policy: SecurityPolicyResult;
  protection?: Awaited<ReturnType<typeof ProtectBeforeSendService.assess>>;
  reason: string;
};

export class OutboundSecurityOrchestrator {
  /**
   * Universal outbound security boundary.
   *
   * This service performs intent creation/validation and policy evaluation
   * before any signing or broadcasting layer is allowed to proceed.
   * It does not sign, broadcast, migrate funds, or expose secrets.
   */
  static async evaluate(
    request: TransactionSecurityGateRequest
  ): Promise<OutboundSecurityResult> {
    const gate = await TransactionSecurityGateService.evaluate(request);

    if (!gate.validation.valid || gate.policy.decision === 'BLOCK') {
      return {
        status: 'BLOCKED',
        gate,
        policy: gate.policy,
        reason: `Outbound transaction blocked by security policy: ${gate.policy.reasonCodes.join(
          ' • '
        )}`,
      };
    }

    if (
      gate.policy.requiresRotation ||
      gate.policy.requiresMigration ||
      gate.policy.decision === 'REQUIRE_ROTATION'
    ) {
      const protection = await ProtectBeforeSendService.assess(
        request.accountId,
        gate.intent.asset.chain,
        gate.intent.from
      );

      if (
        protection.status === 'READY' &&
        !gate.policy.requiresRotation &&
        !gate.policy.requiresMigration
      ) {
        return {
          status: 'READY',
          gate,
          policy: gate.policy,
          protection,
          reason: 'Outbound security requirements are satisfied.',
        };
      }

      return {
        status: 'PROTECTION_REQUIRED',
        gate,
        policy: gate.policy,
        protection,
        reason:
          protection.status === 'BLOCKED'
            ? protection.reason
            : 'Protect Before Send requirements must be satisfied before signing.',
      };
    }

    return {
      status: 'READY',
      gate,
      policy: gate.policy,
      reason: 'Outbound transaction passed security policy evaluation.',
    };
  }
}
