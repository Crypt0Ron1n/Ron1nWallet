import { ethers } from 'ethers';
import type { SignedPayload } from '../crypto/types';
import type { TransactionIntent } from './TransactionIntent';
import {
  BroadcastAuthorizationService,
  BroadcastAuthorization,
} from '../crypto/BroadcastAuthorizationService';
import { ProviderFactory } from '../providers/ProviderFactory';
import type { BroadcastReconciliation } from '../providers/types';
import { TransactionLifecycleService } from './TransactionLifecycleService';

export type BroadcastResult = {
  transactionHash: string;
  reconciliation: BroadcastReconciliation;
  broadcastAccepted: boolean;
};

const RECONCILIATION_ATTEMPTS = 15;
const RECONCILIATION_DELAY_MS = 2000;
const inFlightHashes = new Set<string>();

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
   * Recovery path for app restart/crash/network interruption.
   *
   * This only reconciles an existing signed transaction hash. It never signs
   * or broadcasts a replacement transaction.
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

  static async reconcileRecoverable(): Promise<BroadcastReconciliation[]> {
    const records = await TransactionLifecycleService.listRecoverable();
    const results: BroadcastReconciliation[] = [];

    for (const record of records) {
      try {
        results.push(
          await this.reconcilePersisted(record.transactionHash)
        );
      } catch {
        await TransactionLifecycleService.markReconcileRequired(
          record.transactionHash,
          'Automatic reconciliation could not reach the provider.'
        );
      }
    }

    return results;
  }
}
