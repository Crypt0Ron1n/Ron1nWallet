import { derivePrivacyLevel } from './PrivacyAssessmentService';
import { PrivacyStrategyRegistry } from './PrivacyStrategyRegistry';

export type PrivacySelfTestResult = {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
};

/**
 * Pure logic checks for the privacy capability/assessment model - no
 * AsyncStorage, no network, no identities. Exercises exactly the honesty
 * guarantees this phase exists to enforce.
 */
export class PrivacySelfTestService {
  static run(): PrivacySelfTestResult {
    const evmCapabilities = PrivacyStrategyRegistry.get('EVM').getCapabilities();
    const unimplementedCapabilities = PrivacyStrategyRegistry.get('ALGORAND').getCapabilities();

    const freshIdentity = derivePrivacyLevel({
      capabilities: evmCapabilities,
      hasHoldingIdentity: true,
      hasActivePrivacyRoute: false,
    });

    const ordinaryTransfer = derivePrivacyLevel({
      capabilities: evmCapabilities,
      hasHoldingIdentity: false,
      hasActivePrivacyRoute: false,
    });

    const checks = [
      {
        name: 'EVM_FRESH_IDENTITY_IS_SEPARATED_NOT_PRIVATE',
        passed: freshIdentity.level === 'SEPARATED',
        detail: `A fresh EVM holding identity must report SEPARATED, never PRIVATE. Got ${freshIdentity.level}.`,
      },
      {
        name: 'EVM_PRIVACY_PROTOCOL_NOT_IMPLEMENTED',
        passed: evmCapabilities.capabilities.PRIVACY_ROUTE.availability === 'NOT_IMPLEMENTED',
        detail: `EVM PRIVACY_ROUTE must report NOT_IMPLEMENTED. Got ${evmCapabilities.capabilities.PRIVACY_ROUTE.availability}.`,
      },
      {
        name: 'EVM_ORDINARY_TRANSFER_NOT_UNLINKABLE',
        passed: ordinaryTransfer.linkability === 'NOT_UNLINKABLE',
        detail: `An ordinary EVM transfer must report NOT_UNLINKABLE, never UNLINKABLE. Got ${ordinaryTransfer.linkability}.`,
      },
      {
        name: 'EVM_SEPARATED_IDENTITY_STILL_NOT_UNLINKABLE',
        passed: freshIdentity.linkability === 'NOT_UNLINKABLE',
        detail: `A separated EVM identity must still report NOT_UNLINKABLE. Got ${freshIdentity.linkability}.`,
      },
      {
        name: 'UNIMPLEMENTED_CHAIN_REPORTS_NOT_IMPLEMENTED',
        passed: Object.values(unimplementedCapabilities.capabilities).every(
          (capability) => capability.availability === 'NOT_IMPLEMENTED'
        ),
        detail: 'A chain without a dedicated privacy strategy must report NOT_IMPLEMENTED for every capability, never AVAILABLE.',
      },
    ];

    return {
      passed: checks.every((check) => check.passed),
      checks,
    };
  }
}
