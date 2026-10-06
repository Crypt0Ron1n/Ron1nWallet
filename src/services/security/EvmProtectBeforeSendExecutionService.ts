import { ethers } from 'ethers';

import { BroadcastAuthorizationService } from '../crypto/BroadcastAuthorizationService';
import { SigningAuthorizationService } from '../crypto/SigningAuthorizationService';
import { TransactionSigningService } from '../crypto/TransactionSigningService';
import type { SignedPayload } from '../crypto/types';
import { SecurityPolicyEngine } from '../SecurityPolicyEngine';
import { BroadcastService } from '../transactions/BroadcastService';
import { ActivityService } from '../transactions/ActivityService';
import { IdentityRegistryService, type ShogunIdentityRecord } from '../identity/IdentityRegistryService';
import type { EvmProtectionPlan } from './EvmProtectBeforeSendService';

export type EvmProtectionExecutionStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'FAILED'
  | 'BLOCKED';

export type EvmProtectionExecutionResult = {
  status: EvmProtectionExecutionStatus;
  reason: string;
  transactionHash?: string;
  reconciliationStatus?: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN';
  spendIdentity: ShogunIdentityRecord | null;
  sourceIdentity: ShogunIdentityRecord | null;
};

/**
 * Step 24: execution boundary for an already-prepared EVM Protect Before Send plan.
 *
 * This service never reads or handles secret material. It forces the migration
 * through the same policy, biometric signing, CryptoCore signing, broadcast,
 * reconciliation, and audit boundaries used by normal outbound transactions.
 * The reserved SPEND identity is activated only after the migration is
 * confirmed. The source identity is retired only after that same confirmation.
 */
export class EvmProtectBeforeSendExecutionService {
  static async execute(
    plan: EvmProtectionPlan
  ): Promise<EvmProtectionExecutionResult> {
    const sourceIdentity = plan.sourceIdentity;
    const spendIdentity = plan.spendIdentity;
    const intent = plan.intent;
    const construction = plan.construction;

    if (
      plan.status !== 'READY' ||
      !sourceIdentity ||
      !spendIdentity ||
      !intent ||
      !construction
    ) {
      return {
        status: 'BLOCKED',
        reason: plan.reason || 'Migration plan is not executable.',
        spendIdentity: spendIdentity ?? null,
        sourceIdentity: sourceIdentity ?? null,
      };
    }

    if (sourceIdentity.lifecycle !== 'ACTIVE' || sourceIdentity.purpose !== 'INGRESS') {
      return {
        status: 'BLOCKED',
        reason: 'Migration execution requires an active INGRESS source identity.',
        spendIdentity,
        sourceIdentity,
      };
    }

    if (spendIdentity.lifecycle !== 'RESERVED' || spendIdentity.purpose !== 'SPEND') {
      return {
        status: 'BLOCKED',
        reason: 'Migration execution requires a reserved SPEND identity.',
        spendIdentity,
        sourceIdentity,
      };
    }

    const provider = (await import('../providers/ProviderFactory')).ProviderFactory.getProvider('ETH');
    const providerStatus = await provider.getStatus();
    const policy = SecurityPolicyEngine.evaluate(intent, null, {
      broadcastSupported: true,
      providerConnected: providerStatus.connected,
      providerMode: providerStatus.mode,
    });

    if (policy.decision === 'BLOCK' || policy.requiresRotation || policy.requiresMigration) {
      await IdentityRegistryService.transition(spendIdentity.identityId, 'FAILED');
      return {
        status: 'BLOCKED',
        reason: `Migration security policy blocked execution: ${policy.reasonCodes.join(' • ')}`,
        spendIdentity: null,
        sourceIdentity,
      };
    }

    await ActivityService.addActivity(
      'SEND_REVIEW',
      'Protect Before Send Migration Authorized',
      `Migration ${sourceIdentity.address} → ${spendIdentity.address} passed policy ${policy.policyVersion}.`
    );

    const signingAuthorization = await SigningAuthorizationService.authorize(
      intent,
      policy,
      construction.transactionDigest
    );

    if (!signingAuthorization.authorized) {
      await IdentityRegistryService.transition(spendIdentity.identityId, 'FAILED');
      return {
        status: 'BLOCKED',
        reason: signingAuthorization.reason,
        spendIdentity: null,
        sourceIdentity,
      };
    }

    let signed: SignedPayload;

    try {
      signed = await TransactionSigningService.sign({
        intent,
        construction,
        authorization: signingAuthorization.authorization,
        derivationRef: { index: sourceIdentity.index },
      });
    } catch (error) {
      await IdentityRegistryService.transition(spendIdentity.identityId, 'FAILED');
      return {
        status: 'FAILED',
        reason: error instanceof Error ? error.message : 'Migration signing failed.',
        spendIdentity: null,
        sourceIdentity,
      };
    }

    const broadcastAuthorization = await BroadcastAuthorizationService.authorize(
      intent,
      signed
    );

    if (!broadcastAuthorization.authorized) {
      await IdentityRegistryService.transition(spendIdentity.identityId, 'FAILED');
      return {
        status: 'BLOCKED',
        reason: broadcastAuthorization.reason,
        spendIdentity: null,
        sourceIdentity,
      };
    }

    try {
      const result = await BroadcastService.broadcast(
        intent,
        signed,
        broadcastAuthorization.authorization
      );

      if (result.reconciliation.status === 'CONFIRMED') {
        const activated = await IdentityRegistryService.activate(spendIdentity.identityId);
        await IdentityRegistryService.retire(sourceIdentity.identityId);

        await ActivityService.addActivity(
          'SEND_REVIEW',
          'Protect Before Send Migration Confirmed',
          `Migration ${result.transactionHash} confirmed. Fresh SPEND identity ${spendIdentity.address} is active; source identity retired.`
        );

        return {
          status: 'CONFIRMED',
          reason: 'Asset migration confirmed and the fresh SPEND identity is active.',
          transactionHash: result.transactionHash,
          reconciliationStatus: result.reconciliation.status,
          spendIdentity: activated ?? spendIdentity,
          sourceIdentity: await IdentityRegistryService.get(sourceIdentity.identityId),
        };
      }

      if (result.reconciliation.status === 'PENDING') {
        await ActivityService.addActivity(
          'SEND_REVIEW',
          'Protect Before Send Migration Pending',
          `Migration ${result.transactionHash} was accepted but is not yet confirmed. Source identity remains active.`
        );

        return {
          status: 'PENDING',
          reason: 'Migration broadcast was accepted but confirmation is still pending.',
          transactionHash: result.transactionHash,
          reconciliationStatus: result.reconciliation.status,
          spendIdentity,
          sourceIdentity,
        };
      }

      if (result.reconciliation.status === 'UNKNOWN') {
        // UNKNOWN is not proof of failure - the provider simply could not
        // find the transaction yet. Treating this as FAILED would wrongly
        // retire the spend identity for a migration that may still land.
        await ActivityService.addActivity(
          'SEND_REVIEW',
          'Protect Before Send Migration Status Unknown',
          `Migration ${result.transactionHash} was accepted but could not be located by the provider yet. Source identity remains active; reconciliation should be retried.`
        );

        return {
          status: 'PENDING',
          reason:
            'Migration broadcast was accepted but the provider could not yet locate the transaction. Retry reconciliation before taking further action.',
          transactionHash: result.transactionHash,
          reconciliationStatus: result.reconciliation.status,
          spendIdentity,
          sourceIdentity,
        };
      }

      await IdentityRegistryService.transition(spendIdentity.identityId, 'FAILED');
      return {
        status: 'FAILED',
        reason: 'Migration transaction was mined with a failed execution status.',
        transactionHash: result.transactionHash,
        reconciliationStatus: result.reconciliation.status,
        spendIdentity: null,
        sourceIdentity,
      };
    } catch (error) {
      await ActivityService.addActivity(
        'SEND_BLOCKED',
        'Protect Before Send Migration Failed',
        error instanceof Error ? error.message : 'Migration broadcast failed.'
      );

      return {
        status: 'FAILED',
        reason: error instanceof Error ? error.message : 'Migration broadcast failed.',
        spendIdentity,
        sourceIdentity,
      };
    }
  }
}
