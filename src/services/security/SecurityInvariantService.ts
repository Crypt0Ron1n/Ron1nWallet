import type { SecurityPolicyResult } from '../SecurityPolicyEngine';
import type { TransactionIntent } from '../transactions/TransactionIntent';

export type SecurityInvariantCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export type SecurityInvariantReport = {
  passed: boolean;
  checks: SecurityInvariantCheck[];
};

export class SecurityInvariantService {
  static validateOutboundBoundary(
    intent: TransactionIntent,
    policy: SecurityPolicyResult
  ): SecurityInvariantReport {
    const checks: SecurityInvariantCheck[] = [
      {
        name: 'INTENT_PRESENT',
        passed: Boolean(intent?.intentId && intent.accountId),
        detail: 'Outbound execution requires a valid TransactionIntent.',
      },
      {
        name: 'POLICY_PRESENT',
        passed: Boolean(policy?.policyVersion && policy?.decision),
        detail: 'Outbound execution requires a SecurityPolicyResult.',
      },
      {
        name: 'BLOCK_HONORED',
        passed: policy.decision !== 'BLOCK',
        detail: 'Blocked policy decisions cannot enter signing.',
      },
      {
        name: 'ROTATION_HONORED',
        passed: !policy.requiresRotation,
        detail: 'Required rotation must be completed before signing.',
      },
      {
        name: 'MIGRATION_HONORED',
        passed: !policy.requiresMigration,
        detail: 'Required migration must be completed before signing.',
      },
    ];

    return {
      passed: checks.every((check) => check.passed),
      checks,
    };
  }
}
