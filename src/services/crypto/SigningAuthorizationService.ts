import * as LocalAuthentication from 'expo-local-authentication';

import type { SigningAuthorization } from './types';
import type { SecurityPolicyResult } from '../SecurityPolicyEngine';
import {
  validateTransactionIntent,
  type TransactionIntent,
} from '../transactions/TransactionIntent';

function createAuthorizationId(): string {
  return `sign-auth-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function isDigest(value: string): boolean {
  return /^0x[0-9a-f]{64}$/.test(value);
}

export type SigningAuthorizationResult =
  | {
      authorized: true;
      authorization: SigningAuthorization;
    }
  | {
      authorized: false;
      reason: string;
    };

/**
 * Creates a one-time user authorization for the exact transaction digest
 * produced by TransactionConstructionService.
 *
 * This service never accesses secret material and never signs.
 */
export class SigningAuthorizationService {
  static async authorize(
    intent: TransactionIntent,
    policy: SecurityPolicyResult,
    transactionDigest: string
  ): Promise<SigningAuthorizationResult> {
    const validation = validateTransactionIntent(intent);

    if (!validation.valid) {
      return {
        authorized: false,
        reason: 'Signing authorization blocked: transaction intent is invalid',
      };
    }

    if (policy.decision === 'BLOCK') {
      return {
        authorized: false,
        reason: 'Signing authorization blocked by security policy',
      };
    }

    if (policy.requiresRotation || policy.requiresMigration) {
      return {
        authorized: false,
        reason:
          'Signing authorization blocked until required rotation/migration is complete',
      };
    }

    if (!policy.policyVersion.trim()) {
      return {
        authorized: false,
        reason: 'Signing authorization blocked: missing policy version',
      };
    }

    const normalizedDigest = transactionDigest.trim().toLowerCase();

    if (!isDigest(normalizedDigest)) {
      return {
        authorized: false,
        reason:
          'Signing authorization blocked: missing or invalid transaction digest',
      };
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();

    if (!hasHardware) {
      return {
        authorized: false,
        reason:
          'Signing authorization blocked: device authentication hardware is unavailable',
      };
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!enrolled) {
      return {
        authorized: false,
        reason:
          'Signing authorization blocked: no device authentication method is enrolled',
      };
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authorize Shogun transaction signing',
      fallbackLabel: 'Use device passcode',
    });

    if (!auth.success) {
      return {
        authorized: false,
        reason: 'Signing authorization blocked: device authentication failed',
      };
    }

    const authorization: SigningAuthorization = {
      intentId: intent.intentId,
      accountId: intent.accountId,
      policyDecision: policy.decision,
      policyVersion: policy.policyVersion,
      authorizedAt: Date.now(),
      authorizationId: createAuthorizationId(),
      transactionDigest: normalizedDigest,
    };

    return {
      authorized: true,
      authorization,
    };
  }
}
