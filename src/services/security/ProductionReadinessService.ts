import { SecuritySelfTestService } from './SecuritySelfTestService';
import { QuantumReadinessService } from './QuantumReadinessService';
import type { SecurityPolicyResult } from '../SecurityPolicyEngine';
import type { TransactionIntent } from '../transactions/TransactionIntent';

export type ProductionReadinessReport = {
  ready: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
};

export class ProductionReadinessService {
  static assess(
    intent: TransactionIntent,
    policy: SecurityPolicyResult
  ): ProductionReadinessReport {
    const selfTest = SecuritySelfTestService.run(intent, policy);
    const quantum = QuantumReadinessService.assess(intent.asset.chain);

    const checks = [
      ...selfTest.checks,
      {
        name: 'POST_QUANTUM_STATUS_EXPLICIT',
        passed: !quantum.postQuantumNative,
        detail: 'The wallet does not claim post-quantum-native security where none exists.',
      },
      {
        name: 'POLICY_REQUIRED',
        passed: policy.decision !== 'BLOCK',
        detail: 'Production outbound execution requires policy evaluation.',
      },
    ];

    return {
      ready: checks.every((check) => check.passed),
      checks,
    };
  }
}
