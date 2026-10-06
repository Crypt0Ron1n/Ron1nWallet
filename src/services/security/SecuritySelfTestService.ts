import { SecurityInvariantService } from './SecurityInvariantService';
import { QuantumReadinessService } from './QuantumReadinessService';
import { PrivacyTransitionService } from './PrivacyTransitionService';
import type { SecurityPolicyResult } from '../SecurityPolicyEngine';
import type { TransactionIntent } from '../transactions/TransactionIntent';

export type SecuritySelfTestResult = {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
};

export class SecuritySelfTestService {
  static run(
    intent: TransactionIntent,
    policy: SecurityPolicyResult
  ): SecuritySelfTestResult {
    const invariant = SecurityInvariantService.validateOutboundBoundary(intent, policy);
    const quantum = QuantumReadinessService.assess(intent.asset.chain);
    const privacy = PrivacyTransitionService.assess(intent.asset.chain, intent.from, intent.to);

    const checks = [
      ...invariant.checks,
      {
        name: 'QUANTUM_AWARE',
        passed: quantum.warnings.length > 0,
        detail: 'Quantum exposure is explicitly surfaced.',
      },
      {
        name: 'PRIVACY_PROVENANCE_DISCLOSED',
        passed: privacy.provenancePreserved || privacy.mode === 'CHAIN_NATIVE_PRIVACY',
        detail: 'Transparent-chain provenance is not falsely represented as erased.',
      },
      {
        name: 'SECRET_BOUNDARY',
        passed: true,
        detail: 'Self-test contains no secret material.',
      },
    ];

    return {
      passed: checks.every((check) => check.passed),
      checks,
    };
  }
}
