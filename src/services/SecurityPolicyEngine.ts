import type { AssetExposureReport } from './security/ExposureScannerService';
import type { SecurityProfile, TransactionIntent } from './transactions/TransactionIntent';
import { validateTransactionIntent } from './transactions/TransactionIntent';

export type SecurityPolicyDecision =
  | 'ALLOW'
  | 'RECOMMEND_ROTATION'
  | 'REQUIRE_ROTATION'
  | 'BLOCK';

export type SecurityPolicyReasonCode =
  | 'INTENT_VALID'
  | 'INTENT_INVALID'
  | 'ASSET_NOT_BROADCASTABLE'
  | 'PROVIDER_NOT_CONNECTED'
  | 'PROVIDER_MOCK'
  | 'PROVIDER_DISABLED'
  | 'EXPOSURE_UNKNOWN'
  | 'EXPOSURE_ELEVATED'
  | 'EXPOSURE_LOW'
  | 'EXPOSURE_FRESH'
  | 'MAXIMUM_PROFILE'
  | 'PROTECTED_PROFILE'
  | 'STANDARD_PROFILE'
  | 'ROTATION_REQUIRED'
  | 'ROTATION_RECOMMENDED'
  | 'PROTECT_BEFORE_SEND_MIGRATION'
  | 'ADDRESS_ROTATION_SWEEP';

export type SecurityPolicyCapabilities = {
  broadcastSupported: boolean;
  providerConnected: boolean;
  providerMode: 'MOCK' | 'RPC' | 'DISABLED';
};

export type SecurityPolicyResult = {
  decision: SecurityPolicyDecision;
  requiresRotation: boolean;
  requiresMigration: boolean;
  reasonCodes: SecurityPolicyReasonCode[];
  policyVersion: string;
  decisionId: string;
};

export const SECURITY_POLICY_VERSION = '2.1.0';

function decisionId(
  intent: TransactionIntent,
  decision: SecurityPolicyDecision
): string {
  return `${intent.intentId}:${SECURITY_POLICY_VERSION}:${decision}`;
}

function baseResult(
  intent: TransactionIntent,
  decision: SecurityPolicyDecision,
  requiresRotation: boolean,
  requiresMigration: boolean,
  reasonCodes: SecurityPolicyReasonCode[]
): SecurityPolicyResult {
  return {
    decision,
    requiresRotation,
    requiresMigration,
    reasonCodes: [...new Set(reasonCodes)],
    policyVersion: SECURITY_POLICY_VERSION,
    decisionId: decisionId(intent, decision),
  };
}

function profileOf(intent: TransactionIntent): SecurityProfile {
  return intent.securityProfile;
}

export class SecurityPolicyEngine {
  static evaluate(
    intent: TransactionIntent,
    exposure?: AssetExposureReport | null,
    capabilities: SecurityPolicyCapabilities = {
      broadcastSupported: false,
      providerConnected: false,
      providerMode: 'DISABLED',
    }
  ): SecurityPolicyResult {
    const validation = validateTransactionIntent(intent);

    if (!validation.valid) {
      return baseResult(intent, 'BLOCK', false, false, ['INTENT_INVALID']);
    }

    const reasons: SecurityPolicyReasonCode[] = ['INTENT_VALID'];

    if (!capabilities.broadcastSupported) {
      return baseResult(
        intent,
        'BLOCK',
        false,
        false,
        [...reasons, 'ASSET_NOT_BROADCASTABLE']
      );
    }

    if (!capabilities.providerConnected) {
      return baseResult(
        intent,
        'BLOCK',
        false,
        false,
        [
          ...reasons,
          capabilities.providerMode === 'DISABLED'
            ? 'PROVIDER_DISABLED'
            : 'PROVIDER_NOT_CONNECTED',
        ]
      );
    }

    if (capabilities.providerMode === 'MOCK') {
      return baseResult(
        intent,
        'BLOCK',
        false,
        false,
        [...reasons, 'PROVIDER_MOCK']
      );
    }

    // A Protect Before Send migration is itself the required security
    // transition. It must still be validated and executed through the same
    // signing/broadcast authorization boundaries, but the policy must not
    // recursively require another migration/rotation before that migration
    // or rotation can occur - otherwise rotating is permanently self-blocked
    // by the very policy that demands rotation in the first place.
    if (intent.metadata?.operation === 'PROTECT_BEFORE_SEND_MIGRATION') {
      return baseResult(
        intent,
        'ALLOW',
        false,
        false,
        [...reasons, 'PROTECT_BEFORE_SEND_MIGRATION']
      );
    }

    if (intent.metadata?.operation === 'ADDRESS_ROTATION_SWEEP') {
      return baseResult(
        intent,
        'ALLOW',
        false,
        false,
        [...reasons, 'ADDRESS_ROTATION_SWEEP']
      );
    }

    if (profileOf(intent) === 'MAXIMUM') {
      return baseResult(
        intent,
        'REQUIRE_ROTATION',
        true,
        true,
        [...reasons, 'MAXIMUM_PROFILE', 'ROTATION_REQUIRED']
      );
    }

    if (profileOf(intent) === 'PROTECTED') {
      if (!exposure || exposure.exposureLevel === 'UNKNOWN') {
        return baseResult(
          intent,
          'REQUIRE_ROTATION',
          true,
          true,
          [...reasons, 'PROTECTED_PROFILE', 'EXPOSURE_UNKNOWN', 'ROTATION_REQUIRED']
        );
      }

      if (exposure.exposureLevel === 'ELEVATED') {
        return baseResult(
          intent,
          'REQUIRE_ROTATION',
          true,
          true,
          [...reasons, 'PROTECTED_PROFILE', 'EXPOSURE_ELEVATED', 'ROTATION_REQUIRED']
        );
      }

      return baseResult(
        intent,
        'ALLOW',
        false,
        false,
        [
          ...reasons,
          'PROTECTED_PROFILE',
          exposure.exposureLevel === 'FRESH'
            ? 'EXPOSURE_FRESH'
            : 'EXPOSURE_LOW',
        ]
      );
    }

    if (!exposure || exposure.exposureLevel === 'UNKNOWN') {
      return baseResult(
        intent,
        'RECOMMEND_ROTATION',
        false,
        false,
        [...reasons, 'STANDARD_PROFILE', 'EXPOSURE_UNKNOWN', 'ROTATION_RECOMMENDED']
      );
    }

    if (exposure.exposureLevel === 'ELEVATED') {
      return baseResult(
        intent,
        'RECOMMEND_ROTATION',
        false,
        false,
        [...reasons, 'STANDARD_PROFILE', 'EXPOSURE_ELEVATED', 'ROTATION_RECOMMENDED']
      );
    }

    return baseResult(
      intent,
      'ALLOW',
      false,
      false,
      [
        ...reasons,
        'STANDARD_PROFILE',
        exposure.exposureLevel === 'FRESH'
          ? 'EXPOSURE_FRESH'
          : 'EXPOSURE_LOW',
      ]
    );
  }
}
