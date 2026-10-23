import { ethers } from 'ethers';
import type { SignedPayload } from '../crypto/types';
import type { TransactionIntent } from './TransactionIntent';
import {
  BroadcastAuthorizationService,
  BroadcastAuthorization,
} from '../crypto/BroadcastAuthorizationService';
import { ProviderFactory } from '../providers/ProviderFactory';
import { EvmProvider } from '../providers/EvmProvider';
import type { BroadcastReconciliation } from '../providers/types';
import {
  TransactionLifecycleService,
  type PersistedTransactionLifecycle,
} from './TransactionLifecycleService';

export type BroadcastResult = {
  transactionHash: string;
  reconciliation: BroadcastReconciliation;
  broadcastAccepted: boolean;
};

/**
 * Outcome of a single reconciliation attempt against an already-persisted,
 * already-signed transaction. This never throws for provider/network
 * failures - every expected failure mode (unsupported chain, already
 * reconciling, provider/RPC error) is a typed `ok: false` result so callers
 * (startup recovery and the manual Activity action) can show an honest
 * message instead of crashing or guessing.
 */
export type ReconcilePersistedResult =
  | {
      ok: true;
      reconciliation: BroadcastReconciliation;
      /** True when the record was already CONFIRMED/FAILED and no provider
       * call was made - a terminal result is never re-queried or
       * overwritten. */
      alreadyTerminal: boolean;
    }
  | {
      ok: false;
      code: 'NOT_FOUND' | 'UNSUPPORTED' | 'IN_PROGRESS' | 'PROVIDER_ERROR';
      reason: string;
    };

const RECONCILIATION_ATTEMPTS = 15;
const RECONCILIATION_DELAY_MS = 2000;
const inFlightHashes = new Set<string>();

/** Per-hash guard so a double-tap or an overlapping automatic/manual
 * reconcile can never race on the same persisted record. */
const reconcilingHashes = new Set<string>();

/** Single-flight guard for the bulk recovery pass itself - a second
 * concurrent call (duplicate effect run, repeated unlock, Strict Mode)
 * joins the already-running pass instead of starting a new one. Cleared
 * once the in-flight pass settles, so a later call starts a fresh pass. */
let recoverableRunInFlight: Promise<BroadcastReconciliation[]> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransactionHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export class BroadcastService {
  static async broadcast(
    intent: TransactionIntent,
    signed: SignedPayload,
    authorization: BroadcastAuthorization
  ): Promise<BroadcastResult> {
    BroadcastAuthorizationService.assertValid(intent, signed, authorization);

    if (signed.chain !== 'EVM' || signed.kind !== 'RAW_TRANSACTION') {
      throw new Error(
        'Broadcast blocked: only EVM raw transactions are enabled.'
      );
    }

    const localTransactionHash = ethers.keccak256(signed.rawTransaction);

    if (!isTransactionHash(localTransactionHash)) {
      throw new Error('Broadcast blocked: calculated transaction hash is invalid.');
    }

    if (inFlightHashes.has(localTransactionHash.toLowerCase())) {
      throw new Error(
        'Broadcast blocked: this exact signed transaction is already being processed.'
      );
    }

    const existing = await TransactionLifecycleService.get(localTransactionHash);

    if (
      existing &&
      (existing.state === 'CONFIRMED' ||
        existing.state === 'BROADCAST_ACCEPTED' ||
        existing.state === 'PENDING')
    ) {
      throw new Error(
        `Broadcast blocked: transaction ${localTransactionHash} already has lifecycle state ${existing.state}. Reconcile it instead of broadcasting again.`
      );
    }

    // The raw transaction already encodes its own nonce - reading it back
    // from the signed bytes avoids trusting a second, separately-plumbed
    // value that could drift from what was actually signed.
    let signedNonce: number | undefined;

    try {
      signedNonce = ethers.Transaction.from(signed.rawTransaction).nonce;
    } catch {
      // Malformed raw transactions are caught below by the provider's own
      // parsing; lifecycle persistence should not fail just because the
      // nonce could not be read back.
    }

    await TransactionLifecycleService.create({
      transactionHash: localTransactionHash,
      intentId: intent.intentId,
      accountId: intent.accountId,
      chain: intent.asset.chain,
      asset: intent.asset.symbol,
      network: intent.asset.network,
      from: intent.from,
      to: intent.to,
      amount: intent.amount,
      nonce: signedNonce,
      rawTransaction: signed.rawTransaction,
    });

    await TransactionLifecycleService.transition(
      localTransactionHash,
      'SIGNED'
    );

    inFlightHashes.add(localTransactionHash.toLowerCase());

    try {
      const provider = ProviderFactory.getProvider(intent.asset.symbol);
      const status = await provider.getStatus();

      if (!status.connected || status.mode !== 'RPC') {
        await TransactionLifecycleService.markReconcileRequired(
          localTransactionHash,
          'Live RPC provider is unavailable.'
        );
        throw new Error(
          'Broadcast blocked: live RPC provider is not available.'
        );
      }

      await TransactionLifecycleService.transition(
        localTransactionHash,
        'BROADCASTING'
      );

      let returnedHash: string;

      try {
        returnedHash = await provider.broadcastSignedTransaction(signed);
      } catch (broadcastError) {
        /*
         * The RPC may have accepted the transaction even if the HTTP response
         * was lost. Never sign or submit a replacement here. Reconcile the
         * exact already-signed transaction first.
         */
        try {
          const recovered = await provider.reconcileBroadcast(
            localTransactionHash
          );

          if (
            recovered.status === 'PENDING' ||
            recovered.status === 'CONFIRMED'
          ) {
            await TransactionLifecycleService.transition(
              localTransactionHash,
              recovered.status === 'CONFIRMED'
                ? 'CONFIRMED'
                : 'PENDING',
              {
                blockNumber: recovered.blockNumber,
                confirmations: recovered.confirmations,
              }
            );

            BroadcastAuthorizationService.consume(
              authorization.authorizationId
            );

            return {
              transactionHash: localTransactionHash,
              reconciliation: recovered,
              broadcastAccepted: true,
            };
          }
        } catch {
          // Preserve the original transport failure and require reconciliation.
        }

        await TransactionLifecycleService.markReconcileRequired(
          localTransactionHash,
          broadcastError instanceof Error
            ? broadcastError.message
            : 'Broadcast response was unavailable.'
        );

        throw broadcastError;
      }

      if (
        typeof returnedHash !== 'string' ||
        !isTransactionHash(returnedHash) ||
        returnedHash.toLowerCase() !== localTransactionHash.toLowerCase()
      ) {
        await TransactionLifecycleService.markReconcileRequired(
          localTransactionHash,
          'Provider returned a transaction hash different from the signed payload.'
        );
        throw new Error(
          'Broadcast blocked: provider returned a transaction hash different from the signed payload.'
        );
      }

      await TransactionLifecycleService.transition(
        localTransactionHash,
        'BROADCAST_ACCEPTED'
      );

      BroadcastAuthorizationService.consume(authorization.authorizationId);

      let reconciliation: BroadcastReconciliation = {
        transactionHash: localTransactionHash,
        status: 'PENDING',
        observedAt: new Date().toISOString(),
      };

      for (
        let attempt = 0;
        attempt < RECONCILIATION_ATTEMPTS;
        attempt += 1
      ) {
        try {
          reconciliation = await provider.reconcileBroadcast(
            localTransactionHash
          );
        } catch {
          await TransactionLifecycleService.markReconcileRequired(
            localTransactionHash,
            'Unable to reconcile transaction with the RPC provider.'
          );
          break;
        }

        if (reconciliation.status === 'CONFIRMED') {
          await TransactionLifecycleService.transition(
            localTransactionHash,
            'CONFIRMED',
            {
              blockNumber: reconciliation.blockNumber,
              confirmations: reconciliation.confirmations,
            }
          );
          break;
        }

        if (reconciliation.status === 'FAILED') {
          await TransactionLifecycleService.transition(
            localTransactionHash,
            'FAILED',
            {
              blockNumber: reconciliation.blockNumber,
              confirmations: reconciliation.confirmations,
            }
          );
          break;
        }

        // UNKNOWN is not terminal - the transaction may not have propagated
        // to this node yet. Keep retrying instead of treating it as PENDING
        // (which would wrongly imply the node has actually seen it) or FAILED.
        await TransactionLifecycleService.transition(
          localTransactionHash,
          reconciliation.status === 'UNKNOWN' ? 'UNKNOWN' : 'PENDING',
          {
            confirmations: reconciliation.confirmations,
          }
        );

        if (attempt < RECONCILIATION_ATTEMPTS - 1) {
          await sleep(RECONCILIATION_DELAY_MS);
        }
      }

      return {
        transactionHash: localTransactionHash,
        reconciliation,
        broadcastAccepted: true,
      };
    } finally {
      inFlightHashes.delete(localTransactionHash.toLowerCase());
    }
  }

  /**
   * Whether `recoverPersisted` can actually check this asset's chain
   * state. Only EvmProvider overrides `reconcileBroadcast` with a real
   * implementation; every other chain's provider inherits
   * BaseMockProvider's throwing stub. Exposed so the UI can hide the
   * Reconcile action entirely for a chain that cannot honestly support it,
   * rather than offering an action that is guaranteed to fail.
   */
  static isReconciliationSupported(asset: string): boolean {
    try {
      return ProviderFactory.getProvider(asset) instanceof EvmProvider;
    } catch {
      return false;
    }
  }

  private static terminalReconciliation(
    lifecycle: PersistedTransactionLifecycle
  ): BroadcastReconciliation {
    return {
      transactionHash: lifecycle.transactionHash,
      status: lifecycle.state as 'CONFIRMED' | 'FAILED',
      blockNumber: lifecycle.blockNumber,
      confirmations: lifecycle.confirmations,
      observedAt: lifecycle.updatedAt,
    };
  }

  /**
   * Recovery path for app restart/crash/network interruption.
   *
   * This only reconciles an existing signed transaction hash. It never signs
   * or broadcasts a replacement transaction.
   *
   * Kept exactly as originally implemented (throws on failure, returns the
   * raw BroadcastReconciliation) for its existing callers in the migration/
   * outbound-recovery pipeline. New callers (startup/unlock recovery, the
   * Activity screen's manual action) should use `recoverPersisted` below,
   * which adds the terminal-state guard, the per-hash in-flight guard, and
   * a non-throwing result type without changing this method's contract.
   */
  static async reconcilePersisted(
    transactionHash: string
  ): Promise<BroadcastReconciliation> {
    if (!isTransactionHash(transactionHash)) {
      throw new Error('Reconciliation blocked: invalid transaction hash.');
    }

    const lifecycle = await TransactionLifecycleService.get(transactionHash);

    if (!lifecycle) {
      throw new Error(
        'Reconciliation blocked: transaction is not known to Ron1n.'
      );
    }

    const provider = ProviderFactory.getProvider(lifecycle.asset);
    const reconciliation = await provider.reconcileBroadcast(transactionHash);

    if (reconciliation.status === 'CONFIRMED') {
      await TransactionLifecycleService.transition(
        transactionHash,
        'CONFIRMED',
        {
          blockNumber: reconciliation.blockNumber,
          confirmations: reconciliation.confirmations,
        }
      );
    } else if (reconciliation.status === 'FAILED') {
      await TransactionLifecycleService.transition(
        transactionHash,
        'FAILED',
        {
          blockNumber: reconciliation.blockNumber,
          confirmations: reconciliation.confirmations,
        }
      );
    } else if (reconciliation.status === 'UNKNOWN') {
      await TransactionLifecycleService.transition(
        transactionHash,
        'UNKNOWN',
        {
          confirmations: reconciliation.confirmations,
        }
      );
    } else {
      await TransactionLifecycleService.transition(
        transactionHash,
        'PENDING',
        {
          confirmations: reconciliation.confirmations,
        }
      );
    }

    return reconciliation;
  }

  /**
   * Hardened single-transaction recovery entry point for startup/unlock
   * recovery and the Activity screen's manual action. Never throws for
   * provider/network failures. Safe to call repeatedly for the same hash: a
   * CONFIRMED/FAILED record is treated as terminal and is never re-queried
   * or overwritten by a later, weaker observation, and a provider/RPC
   * failure is reported as `PROVIDER_ERROR` - never recorded as FAILED,
   * since an unreachable provider is not proof the transaction failed.
   */
  static async recoverPersisted(
    transactionHash: string
  ): Promise<ReconcilePersistedResult> {
    if (!isTransactionHash(transactionHash)) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        reason: 'Reconciliation blocked: invalid transaction hash.',
      };
    }

    const normalized = transactionHash.toLowerCase();

    const lifecycle = await TransactionLifecycleService.get(transactionHash);

    if (!lifecycle) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        reason: 'Reconciliation blocked: transaction is not known to Ron1n.',
      };
    }

    // A terminal record is authoritative. Never re-query (and risk
    // overwriting it with a transient PENDING/UNKNOWN observation) once the
    // chain has already produced a final result.
    if (lifecycle.state === 'CONFIRMED' || lifecycle.state === 'FAILED') {
      return {
        ok: true,
        reconciliation: this.terminalReconciliation(lifecycle),
        alreadyTerminal: true,
      };
    }

    if (!this.isReconciliationSupported(lifecycle.asset)) {
      return {
        ok: false,
        code: 'UNSUPPORTED',
        reason: `Reconciliation is not implemented for ${lifecycle.asset} yet - only EVM assets have a live reconciliation provider.`,
      };
    }

    if (reconcilingHashes.has(normalized)) {
      return {
        ok: false,
        code: 'IN_PROGRESS',
        reason: 'This transaction is already being reconciled.',
      };
    }

    reconcilingHashes.add(normalized);

    try {
      const provider = ProviderFactory.getProvider(lifecycle.asset);

      let reconciliation: BroadcastReconciliation;

      try {
        reconciliation = await provider.reconcileBroadcast(transactionHash);
      } catch (error) {
        await TransactionLifecycleService.markReconcileRequired(
          transactionHash,
          error instanceof Error
            ? error.message
            : 'Reconciliation could not reach the provider.'
        );

        return {
          ok: false,
          code: 'PROVIDER_ERROR',
          reason:
            error instanceof Error
              ? error.message
              : 'Reconciliation could not reach the provider. This is not proof the transaction failed.',
        };
      }

      let updated: PersistedTransactionLifecycle | null;

      if (reconciliation.status === 'CONFIRMED') {
        updated = await TransactionLifecycleService.transition(
          transactionHash,
          'CONFIRMED',
          {
            blockNumber: reconciliation.blockNumber,
            confirmations: reconciliation.confirmations,
          }
        );
      } else if (reconciliation.status === 'FAILED') {
        updated = await TransactionLifecycleService.transition(
          transactionHash,
          'FAILED',
          {
            blockNumber: reconciliation.blockNumber,
            confirmations: reconciliation.confirmations,
          }
        );
      } else if (reconciliation.status === 'UNKNOWN') {
        updated = await TransactionLifecycleService.transition(
          transactionHash,
          'UNKNOWN',
          {
            confirmations: reconciliation.confirmations,
          }
        );
      } else {
        updated = await TransactionLifecycleService.transition(
          transactionHash,
          'PENDING',
          {
            confirmations: reconciliation.confirmations,
          }
        );
      }

      // Report what was actually persisted, not the raw provider
      // observation we just tried to apply. `transition()` may have
      // correctly refused this exact write (e.g. the record became
      // CONFIRMED/FAILED via a concurrent transition while this provider
      // call was in flight) - in that case `updated` is the unchanged
      // terminal record, and the caller must be told that, never the
      // stale observation that was rejected. `updated.state` is always one
      // of CONFIRMED/FAILED/PENDING/UNKNOWN here, since those are the only
      // states ever requested above.
      if (!updated) {
        return {
          ok: false,
          code: 'NOT_FOUND',
          reason: 'Reconciliation blocked: transaction record disappeared during reconciliation.',
        };
      }

      const authoritative: BroadcastReconciliation = {
        transactionHash,
        status: updated.state as BroadcastReconciliation['status'],
        blockNumber: updated.blockNumber,
        confirmations: updated.confirmations,
        observedAt: updated.updatedAt,
      };

      return { ok: true, reconciliation: authoritative, alreadyTerminal: false };
    } finally {
      reconcilingHashes.delete(normalized);
    }
  }

  /**
   * Bulk startup/unlock recovery pass over every persisted transaction left
   * in a non-terminal state. Bounded: one reconciliation attempt per
   * eligible record, no retry polling here (the broadcast-time retry loop
   * already lives in `broadcast()`). Single-flight: a second concurrent
   * call (duplicate effect run, repeated unlock, Strict Mode) joins the
   * already-running pass instead of starting a new one; the guard clears
   * once the pass settles, so a later call starts a fresh pass.
   */
  static async reconcileRecoverable(): Promise<BroadcastReconciliation[]> {
    if (recoverableRunInFlight) {
      return recoverableRunInFlight;
    }

    const run = (async () => {
      const records = await TransactionLifecycleService.listRecoverable();
      const results: BroadcastReconciliation[] = [];

      for (const record of records) {
        try {
          const result = await this.recoverPersisted(record.transactionHash);

          if (result.ok) {
            results.push(result.reconciliation);
          }
        } catch {
          // Defensive only - recoverPersisted() does not throw for
          // provider/network failures. Never let one bad record abort the
          // rest of the recovery pass or crash app startup.
          await TransactionLifecycleService.markReconcileRequired(
            record.transactionHash,
            'Automatic reconciliation could not reach the provider.'
          );
        }
      }

      return results;
    })();

    recoverableRunInFlight = run;

    try {
      return await run;
    } finally {
      recoverableRunInFlight = null;
    }
  }
}
