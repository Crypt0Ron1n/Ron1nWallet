import {
  validateTransactionIntent,
  type TransactionIntent,
  type TransactionIntentValidationResult,
} from '../transactions/TransactionIntent';
import {
  SecurityPolicyEngine,
  type SecurityPolicyCapabilities,
  type SecurityPolicyResult,
} from '../SecurityPolicyEngine';

export type OutboundIntentGuardResult = {
  validation: TransactionIntentValidationResult;
  policy: SecurityPolicyResult;
  canSign: boolean;
  canBroadcast: boolean;
  reason: string;
};

/**
 * Single-purpose fail-closed guard for outbound intent validation.
 *
 * This service does not sign, broadcast, migrate assets, or access secrets.
 * It exists so UI/controllers can ask one deterministic question before
 * entering the authorization/signing boundary.
 */
export class OutboundIntentGuardService {
  static evaluate(
    intent: TransactionIntent,
    capabilities: SecurityPolicyCapabilities
  ): OutboundIntentGuardResult {
    const validation = validateTransactionIntent(intent);
    const policy = SecurityPolicyEngine.evaluate(intent, null, capabilities);

    const canSign =
      validation.valid &&
      policy.decision !== 'BLOCK' &&
      !policy.requiresRotation &&
      !policy.requiresMigration;

    // Provider mode 'RPC' represents a live RPC-backed provider in the
    // current policy capability model. MOCK and DISABLED must never broadcast.
    const canBroadcast =
      canSign &&
      capabilities.broadcastSupported === true &&
      capabilities.providerConnected === true &&
      capabilities.providerMode === 'RPC';

    let reason = 'Outbound intent passed validation and policy checks.';

    if (!validation.valid) {
      reason = `Intent validation failed: ${validation.codes.join(' • ')}`;
    } else if (policy.decision === 'BLOCK') {
      reason = `Security policy blocked the transaction: ${policy.reasonCodes.join(' • ')}`;
    } else if (policy.requiresMigration) {
      reason = 'Asset migration is required before signing.';
    } else if (policy.requiresRotation) {
      reason = 'Key rotation is required before signing.';
    } else if (!canBroadcast) {
      reason = 'Broadcast capability is not currently available.';
    }

    return {
      validation,
      policy,
      canSign,
      canBroadcast,
      reason,
    };
  }
}
