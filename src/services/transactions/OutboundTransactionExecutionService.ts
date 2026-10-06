import { SigningAuthorizationService } from '../crypto/SigningAuthorizationService';
import { TransactionSigningService } from '../crypto/TransactionSigningService';
import { BroadcastAuthorizationService } from '../crypto/BroadcastAuthorizationService';
import { BroadcastService } from './BroadcastService';
import { TransactionConstructionService } from './TransactionConstructionService';
import type { TransactionIntent } from './TransactionIntent';
import type { SecurityPolicyResult } from '../SecurityPolicyEngine';
import type { SignedPayload, DerivationReference } from '../crypto/types';

export type OutboundExecutionStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'FAILED'
  | 'BLOCKED'
  | 'RECONCILE_REQUIRED';

export type OutboundExecutionRequest = {
  intent: TransactionIntent;
  policy: SecurityPolicyResult;
  derivationRef: DerivationReference;
};

export type OutboundExecutionResult = {
  status: OutboundExecutionStatus;
  intentId: string;
  transactionDigest?: string;
  transactionHash?: string;
  signed?: SignedPayload;
  reason: string;
};

export class OutboundTransactionExecutionService {
  static async execute(
    request: OutboundExecutionRequest
  ): Promise<OutboundExecutionResult> {
    const { intent, policy, derivationRef } = request;

    if (policy.decision === 'BLOCK' || policy.requiresRotation || policy.requiresMigration) {
      return {
        status: 'BLOCKED',
        intentId: intent.intentId,
        reason: 'Outbound policy requires protection, migration, or blocks this transaction.',
      };
    }

    if (!Number.isInteger(derivationRef.index) || derivationRef.index < 0) {
      return {
        status: 'BLOCKED',
        intentId: intent.intentId,
        reason: 'Invalid derivation reference.',
      };
    }

    try {
      const construction = await TransactionConstructionService.prepare(intent);

      const signingAuthorization = await SigningAuthorizationService.authorize(
        intent,
        policy,
        construction.transactionDigest
      );

      if (!signingAuthorization.authorized) {
        return {
          status: 'BLOCKED',
          intentId: intent.intentId,
          transactionDigest: construction.transactionDigest,
          reason: signingAuthorization.reason,
        };
      }

      const signed = await TransactionSigningService.sign({
        intent,
        construction,
        authorization: signingAuthorization.authorization,
        derivationRef,
      });

      const broadcastAuthorization =
        await BroadcastAuthorizationService.authorize(intent, signed);

      if (!broadcastAuthorization.authorized) {
        return {
          status: 'BLOCKED',
          intentId: intent.intentId,
          transactionDigest: construction.transactionDigest,
          signed,
          reason: broadcastAuthorization.reason,
        };
      }

      const broadcast = await BroadcastService.broadcast(
        intent,
        signed,
        broadcastAuthorization.authorization
      );

      const reconciliation = broadcast.reconciliation;

      if (reconciliation.status === 'CONFIRMED') {
        return {
          status: 'CONFIRMED',
          intentId: intent.intentId,
          transactionDigest: construction.transactionDigest,
          transactionHash: broadcast.transactionHash,
          signed,
          reason: 'Transaction confirmed.',
        };
      }

      if (reconciliation.status === 'PENDING') {
        return {
          status: 'PENDING',
          intentId: intent.intentId,
          transactionDigest: construction.transactionDigest,
          transactionHash: broadcast.transactionHash,
          signed,
          reason: 'Broadcast accepted; confirmation is pending.',
        };
      }

      if (reconciliation.status === 'UNKNOWN') {
        // UNKNOWN means the provider could not locate the transaction yet -
        // it is not proof of failure. Route this to RECONCILE_REQUIRED (the
        // same bucket used for thrown errors below) instead of FAILED, so
        // nothing downstream treats an unresolved transaction as dead.
        return {
          status: 'RECONCILE_REQUIRED',
          intentId: intent.intentId,
          transactionDigest: construction.transactionDigest,
          transactionHash: broadcast.transactionHash,
          signed,
          reason: 'Broadcast accepted but the provider could not yet locate the transaction; reconciliation required.',
        };
      }

      return {
        status: 'FAILED',
        intentId: intent.intentId,
        transactionDigest: construction.transactionDigest,
        transactionHash: broadcast.transactionHash,
        signed,
        reason: 'Network reconciliation reported a failed transaction.',
      };
    } catch (error) {
      return {
        status: 'RECONCILE_REQUIRED',
        intentId: intent.intentId,
        reason:
          error instanceof Error
            ? error.message
            : 'Outbound execution failed and requires reconciliation.',
      };
    }
  }
}
