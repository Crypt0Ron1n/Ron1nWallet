import { BroadcastAuthorizationService } from '../crypto/BroadcastAuthorizationService';
import { SigningAuthorizationService } from '../crypto/SigningAuthorizationService';
import { TransactionSigningService } from '../crypto/TransactionSigningService';
import { SecurityPolicyEngine } from '../SecurityPolicyEngine';
import { ProviderFactory } from '../providers/ProviderFactory';
import { BroadcastService } from '../transactions/BroadcastService';
import { IdentityRegistryService } from '../identity/IdentityRegistryService';
import { MigrationAuditService } from './MigrationAuditService';
import { MigrationExecutionRecoveryService } from './MigrationExecutionRecoveryService';
import { MigrationSafetyValidationService } from './MigrationSafetyValidationService';
import type { AssetMigrationPlan } from './types';

export type AssetMigrationExecutionStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'FAILED'
  | 'BLOCKED';

export type AssetMigrationExecutionResult = {
  status: AssetMigrationExecutionStatus;
  reason: string;
  transactionHash?: string;
  reconciliationStatus?: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN';
};

export class AssetMigrationExecutionService {
  static async execute(
    plan: AssetMigrationPlan
  ): Promise<AssetMigrationExecutionResult> {
    const block = async (reason: string): Promise<AssetMigrationExecutionResult> => {
      await MigrationAuditService.record('PLAN_BLOCKED', plan, reason);
      return { status: 'BLOCKED', reason };
    };

    if (plan.status !== 'READY' || !plan.canExecute || !plan.construction) {
      return block(plan.reason || 'Migration plan is not executable.');
    }

    const sourceIdentity = await IdentityRegistryService.get(
      plan.sourceIdentityId
    );
    const destinationIdentity = await IdentityRegistryService.get(
      plan.destinationIdentityId
    );

    const planSafety = MigrationSafetyValidationService.validatePlan(
      plan,
      sourceIdentity ?? undefined,
      destinationIdentity ?? undefined
    );

    if (!planSafety.valid) {
      return block(planSafety.reason);
    }

    await MigrationAuditService.record(
      'PLAN_CREATED',
      plan,
      'Plan passed pre-execution safety validation.'
    );

    /*
     * Idempotency boundary:
     * once a migration intent has produced a signed/broadcast transaction,
     * never sign a second transaction for that same intent. Recover the exact
     * known transaction instead.
     */
    const recovery = await MigrationExecutionRecoveryService.get(
      plan.intentId
    );

    if (recovery?.transactionHash) {
      try {
        const reconciliation = await BroadcastService.reconcilePersisted(
          recovery.transactionHash
        );

        if (reconciliation.status === 'CONFIRMED') {
          await MigrationExecutionRecoveryService.mark(
            plan.intentId,
            'CONFIRMED',
            recovery.transactionHash
          );
          return this.finalizeConfirmed(
            plan,
            recovery.transactionHash,
            recovery.destinationIdentityId,
            recovery.sourceIdentityId
          );
        }

        if (reconciliation.status === 'PENDING') {
          await MigrationExecutionRecoveryService.mark(
            plan.intentId,
            'PENDING',
            recovery.transactionHash
          );
          await MigrationAuditService.record(
            'PENDING',
            plan,
            `Recovered existing transaction ${recovery.transactionHash}; source identity remains active.`
          );
          return {
            status: 'PENDING',
            reason:
              'An existing migration transaction is still pending. Ron1n will not sign or broadcast a replacement.',
            transactionHash: recovery.transactionHash,
            reconciliationStatus: 'PENDING',
          };
        }

        if (reconciliation.status === 'UNKNOWN') {
          // UNKNOWN means the provider could not locate the transaction yet,
          // not that it failed on-chain. This is exactly the ambiguous state
          // from the known stuck-transaction incident - mark it for
          // reconciliation, never FAILED, and never sign a replacement.
          await MigrationExecutionRecoveryService.mark(
            plan.intentId,
            'RECONCILE_REQUIRED',
            recovery.transactionHash
          );
          await MigrationAuditService.record(
            'PENDING',
            plan,
            `Recovered transaction ${recovery.transactionHash} could not be located by the provider yet; reconciliation required. No replacement will be signed.`
          );
          return {
            status: 'PENDING',
            reason:
              'An existing migration transaction could not yet be located by the provider. Ron1n will not sign or broadcast a replacement; retry reconciliation.',
            transactionHash: recovery.transactionHash,
            reconciliationStatus: 'UNKNOWN',
          };
        }

        await MigrationExecutionRecoveryService.mark(
          plan.intentId,
          'FAILED',
          recovery.transactionHash
        );
        await MigrationAuditService.record(
          'FAILED',
          plan,
          `Recovered transaction ${recovery.transactionHash} reconciled as failed.`
        );
        return {
          status: 'FAILED',
          reason:
            'The existing migration transaction reconciled as failed. Prepare a new migration intent rather than re-signing this intent.',
          transactionHash: recovery.transactionHash,
          reconciliationStatus: 'FAILED',
        };
      } catch (error) {
        await MigrationExecutionRecoveryService.mark(
          plan.intentId,
          'RECONCILE_REQUIRED',
          recovery.transactionHash
        );
        return {
          status: 'BLOCKED',
          reason:
            error instanceof Error
              ? `Existing migration requires reconciliation: ${error.message}`
              : 'Existing migration requires reconciliation before execution can continue.',
          transactionHash: recovery.transactionHash,
        };
      }
    }

    if (!sourceIdentity || !destinationIdentity) {
      return block('Migration identities could not be resolved.');
    }

    const provider = ProviderFactory.getProvider(
      plan.chain === 'EVM' ? 'ETH' : plan.chain
    );
    const providerStatus = await provider.getStatus();

    const policy = SecurityPolicyEngine.evaluate(
      plan.intent,
      null,
      {
        broadcastSupported: true,
        providerConnected: providerStatus.connected,
        providerMode: providerStatus.mode,
      }
    );

    if (
      policy.decision === 'BLOCK' ||
      policy.requiresRotation ||
      policy.requiresMigration
    ) {
      return block(
        `Migration security policy blocked execution: ${policy.reasonCodes.join(
          ' • '
        )}`
      );
    }

    const constructionSafety =
      MigrationSafetyValidationService.validateConstruction(
        plan,
        plan.construction
      );

    if (!constructionSafety.valid) {
      return block(constructionSafety.reason);
    }

    await MigrationAuditService.record(
      'AUTHORIZATION_STARTED',
      plan,
      `Migration passed universal policy ${policy.policyVersion}; biometric/user authorization is required.`
    );

    let signingAuthorization;
    try {
      signingAuthorization = await SigningAuthorizationService.authorize(
        plan.intent,
        policy,
        plan.construction.transactionDigest
      );
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : 'Signing authorization failed.';
      await MigrationAuditService.record('FAILED', plan, reason);
      return { status: 'BLOCKED', reason };
    }

    if (!signingAuthorization.authorized) {
      const reason = signingAuthorization.reason;
      await MigrationAuditService.record('PLAN_BLOCKED', plan, reason);
      return { status: 'BLOCKED', reason };
    }

    const authorizationSafety =
      MigrationSafetyValidationService.validateAuthorization(
        plan,
        signingAuthorization.authorization
      );

    if (!authorizationSafety.valid) {
      return block(authorizationSafety.reason);
    }

    let signed;
    try {
      signed = await TransactionSigningService.sign({
        intent: plan.intent,
        construction: plan.construction,
        authorization: signingAuthorization.authorization,
        derivationRef: { index: sourceIdentity.index },
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Migration signing failed.';
      await MigrationAuditService.record('FAILED', plan, reason);
      return { status: 'FAILED', reason };
    }

    const signedSafety = MigrationSafetyValidationService.validateSignedPayload(
      plan,
      signed
    );

    if (!signedSafety.valid) {
      return block(signedSafety.reason);
    }

    await MigrationExecutionRecoveryService.upsert({
      intentId: plan.intentId,
      accountId: plan.accountId,
      sourceIdentityId: plan.sourceIdentityId,
      destinationIdentityId: plan.destinationIdentityId,
      transactionDigest: plan.construction.transactionDigest,
      status: 'SIGNED',
    });

    await MigrationAuditService.record(
      'SIGNED',
      plan,
      'Signed payload passed digest-binding safety validation.'
    );

    let broadcastAuthorization;
    try {
      broadcastAuthorization =
        await BroadcastAuthorizationService.authorize(plan.intent, signed);
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : 'Broadcast authorization failed.';
      await MigrationAuditService.record('FAILED', plan, reason);
      return { status: 'BLOCKED', reason };
    }

    if (!broadcastAuthorization.authorized) {
      const reason = broadcastAuthorization.reason;
      await MigrationAuditService.record('PLAN_BLOCKED', plan, reason);
      return { status: 'BLOCKED', reason };
    }

    let result;
    try {
      result = await BroadcastService.broadcast(
        plan.intent,
        signed,
        broadcastAuthorization.authorization
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Migration broadcast failed.';
      await MigrationExecutionRecoveryService.mark(
        plan.intentId,
        'RECONCILE_REQUIRED'
      );
      await MigrationAuditService.record(
        'FAILED',
        plan,
        `${reason} No replacement transaction was signed.`
      );
      return { status: 'FAILED', reason };
    }

    await MigrationExecutionRecoveryService.upsert({
      intentId: plan.intentId,
      accountId: plan.accountId,
      sourceIdentityId: plan.sourceIdentityId,
      destinationIdentityId: plan.destinationIdentityId,
      transactionDigest: plan.construction.transactionDigest,
      transactionHash: result.transactionHash,
      status:
        result.reconciliation.status === 'CONFIRMED'
          ? 'CONFIRMED'
          : result.reconciliation.status === 'PENDING'
            ? 'PENDING'
            : result.reconciliation.status === 'UNKNOWN'
              ? 'RECONCILE_REQUIRED'
              : 'FAILED',
    });

    await MigrationAuditService.record(
      'BROADCAST',
      plan,
      `Transaction ${result.transactionHash} was accepted by the broadcast workflow.`
    );

    if (result.reconciliation.status === 'CONFIRMED') {
      return this.finalizeConfirmed(
        plan,
        result.transactionHash,
        plan.destinationIdentityId,
        plan.sourceIdentityId
      );
    }

    if (result.reconciliation.status === 'PENDING') {
      await MigrationAuditService.record(
        'PENDING',
        plan,
        `Transaction ${result.transactionHash} remains pending; source identity remains active.`
      );

      return {
        status: 'PENDING',
        reason:
          'Migration broadcast was accepted but confirmation is still pending.',
        transactionHash: result.transactionHash,
        reconciliationStatus: 'PENDING',
      };
    }

    if (result.reconciliation.status === 'UNKNOWN') {
      // UNKNOWN means the provider could not locate the transaction yet, not
      // that it failed. Do not retire/finalize anything on this signal.
      await MigrationAuditService.record(
        'PENDING',
        plan,
        `Transaction ${result.transactionHash} could not be located by the provider yet; reconciliation required.`
      );

      return {
        status: 'PENDING',
        reason:
          'Migration broadcast was accepted but the provider could not yet locate the transaction. Retry reconciliation before taking further action.',
        transactionHash: result.transactionHash,
        reconciliationStatus: 'UNKNOWN',
      };
    }

    await MigrationAuditService.record(
      'FAILED',
      plan,
      `Transaction ${result.transactionHash} reconciled as failed.`
    );

    return {
      status: 'FAILED',
      reason: 'Migration transaction reconciliation reported failure.',
      transactionHash: result.transactionHash,
      reconciliationStatus: 'FAILED',
    };
  }

  private static async finalizeConfirmed(
    plan: AssetMigrationPlan,
    transactionHash: string,
    destinationIdentityId: string,
    sourceIdentityId: string
  ): Promise<AssetMigrationExecutionResult> {
    const destinationIdentity = await IdentityRegistryService.get(
      destinationIdentityId
    );
    const sourceIdentity = await IdentityRegistryService.get(sourceIdentityId);

    if (!destinationIdentity || !sourceIdentity) {
      await MigrationAuditService.record(
        'FAILED',
        plan,
        `Confirmed transaction ${transactionHash} could not resolve both identities for lifecycle reconciliation.`
      );
      return {
        status: 'FAILED',
        reason:
          'Migration confirmed, but identity lifecycle records could not be resolved safely.',
        transactionHash,
        reconciliationStatus: 'CONFIRMED',
      };
    }

    if (destinationIdentity.lifecycle === 'RESERVED') {
      const activated = await IdentityRegistryService.activate(
        destinationIdentity.identityId
      );

      if (!activated) {
        await MigrationAuditService.record(
          'FAILED',
          plan,
          `Confirmed transaction ${transactionHash} could not activate the destination identity.`
        );
        return {
          status: 'FAILED',
          reason:
            'Migration confirmed, but the destination identity could not be activated safely.',
          transactionHash,
          reconciliationStatus: 'CONFIRMED',
        };
      }
    } else if (destinationIdentity.lifecycle !== 'ACTIVE') {
      await MigrationAuditService.record(
        'FAILED',
        plan,
        `Confirmed transaction ${transactionHash} found an unexpected destination lifecycle state.`
      );
      return {
        status: 'FAILED',
        reason:
          'Migration confirmed, but destination identity lifecycle state is invalid.',
        transactionHash,
        reconciliationStatus: 'CONFIRMED',
      };
    }

    if (sourceIdentity.lifecycle === 'ACTIVE') {
      await IdentityRegistryService.retire(sourceIdentity.identityId);
    } else if (sourceIdentity.lifecycle !== 'RETIRED') {
      await MigrationAuditService.record(
        'FAILED',
        plan,
        `Confirmed transaction ${transactionHash} found an unexpected source lifecycle state.`
      );
      return {
        status: 'FAILED',
        reason:
          'Migration confirmed, but source identity lifecycle state is invalid.',
        transactionHash,
        reconciliationStatus: 'CONFIRMED',
      };
    }

    await MigrationExecutionRecoveryService.mark(
      plan.intentId,
      'CONFIRMED',
      transactionHash
    );

    await MigrationAuditService.record(
      'CONFIRMED',
      plan,
      `Migration ${transactionHash} confirmed. Destination identity is active and source identity is retired.`
    );

    return {
      status: 'CONFIRMED',
      reason:
        'Asset migration confirmed and identity lifecycle transition completed.',
      transactionHash,
      reconciliationStatus: 'CONFIRMED',
    };
  }
}
