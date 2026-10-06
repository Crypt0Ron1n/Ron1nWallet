import { ActivityService } from './ActivityService';
import type { TransactionIntent } from './TransactionIntent';
import type { SecurityPolicyResult } from '../SecurityPolicyEngine';

export class SecurityAuditService {
  static async policyEvaluated(
    intent: TransactionIntent,
    policy: SecurityPolicyResult
  ): Promise<void> {
    await ActivityService.addActivity(
      'SECURITY',
      'Outbound Policy Evaluated',
      `${intent.asset.symbol} ${intent.intentId}: ${policy.decision}; rotation=${policy.requiresRotation}; migration=${policy.requiresMigration}; policy=${policy.policyVersion}.`
    );
  }

  static async blocked(
    intent: TransactionIntent,
    reason: string
  ): Promise<void> {
    await ActivityService.addActivity(
      'SEND_BLOCKED',
      'Outbound Security Blocked',
      `${intent.asset.symbol} ${intent.intentId}: ${reason}`
    );
  }

  static async authorized(
    intent: TransactionIntent
  ): Promise<void> {
    await ActivityService.addActivity(
      'SECURITY',
      'Outbound Authorization Completed',
      `${intent.asset.symbol} ${intent.intentId}: authorization boundary completed without recording secret material.`
    );
  }
}
