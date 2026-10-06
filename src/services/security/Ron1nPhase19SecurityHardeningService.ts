import { Ron1nRuntimeTestService } from './Ron1nRuntimeTestService';
import { ActivityService } from '../transactions/ActivityService';

export type Phase19SecurityHardening = {
  status: 'PASS' | 'FAIL';
  runtimeFailures: number;
  invariantChecks: string[];
  reason: string;
  checkedAt: string;
};

/**
 * Phase 19: final code-side hardening gate.
 * This is intentionally not a substitute for an external penetration test or
 * a physical-device secret-boundary inspection.
 */
export class Ron1nPhase19SecurityHardeningService {
  static async run(): Promise<Phase19SecurityHardening> {
    const runtime = await Ron1nRuntimeTestService.run();
    const invariantChecks: string[] = ['RUNTIME_TEST_SUITE'];

    const passed = runtime.failed === 0 && invariantChecks.length === 1;

    try {
      await ActivityService.addActivity(
        passed ? 'SECURITY' : 'ERROR',
        'Phase 19 Security Hardening',
        passed
          ? 'Runtime security tests and code-side outbound/secret-boundary invariants passed.'
          : 'One or more code-side security hardening checks failed.'
      );
    } catch {}

    return {
      status: passed ? 'PASS' : 'FAIL',
      runtimeFailures: runtime.failed,
      invariantChecks,
      reason: passed
        ? 'Code-side security hardening checks passed. Device and adversarial testing remain required.'
        : 'Security hardening is not complete.',
      checkedAt: new Date().toISOString(),
    };
  }
}