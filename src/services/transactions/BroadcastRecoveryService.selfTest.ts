import { ethers } from 'ethers';

import { BroadcastService, type ReconcilePersistedResult } from './BroadcastService';
import { TransactionLifecycleService } from './TransactionLifecycleService';
import { ProviderFactory } from '../providers/ProviderFactory';
import { EvmProvider } from '../providers/EvmProvider';
import { UtxoProvider } from '../providers/UtxoProvider';
import type { BroadcastReconciliation } from '../providers/types';

export type BroadcastRecoveryServiceSelfTestResult = {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorCodeOf(result: ReconcilePersistedResult): string | null {
  return result.ok ? null : result.code;
}

function rawTxHash(seed: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(seed));
}

/**
 * Deterministic tests for the recovery path (`BroadcastService.recoverPersisted`
 * / `reconcileRecoverable`, wired from App.tsx on startup and from
 * ActivityScreen's manual Reconcile action). Uses a real
 * `TransactionLifecycleService` (backed by the project's AsyncStorage stub
 * when run standalone, or the real module on-device) so persistence
 * round-trips are genuinely exercised, and a mocked provider layer
 * (`ProviderFactory.getProvider` monkey-patched for the duration of this
 * run, restored at the end) so no real network call or real broadcast ever
 * happens.
 */
export class BroadcastRecoveryServiceSelfTestService {
  static async run(): Promise<BroadcastRecoveryServiceSelfTestResult> {
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
    const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });

    const originalGetProvider = ProviderFactory.getProvider;
    let broadcastCallCount = 0;

    const evmProvider = new EvmProvider('ETH', 1, 'http://127.0.0.1:1');
    let reconcileResponder: (hash: string) => Promise<BroadcastReconciliation>;

    evmProvider.reconcileBroadcast = async (hash: string) => reconcileResponder(hash);
    evmProvider.broadcastSignedTransaction = async () => {
      broadcastCallCount += 1;
      throw new Error('Mock provider: broadcastSignedTransaction should never be called during reconciliation.');
    };

    (ProviderFactory as unknown as { getProvider: typeof ProviderFactory.getProvider }).getProvider = (
      asset: string
    ) => (asset.toUpperCase() === 'BTC' ? new UtxoProvider('BTC') : evmProvider);

    const makeRecord = async (seed: string, initialState: 'PENDING' | 'UNKNOWN' | 'CONFIRMED' | 'RECONCILE_REQUIRED' | 'BROADCASTING' = 'PENDING') => {
      const hash = rawTxHash(seed);

      await TransactionLifecycleService.create({
        transactionHash: hash,
        intentId: `intent-${seed}`,
        accountId: 'primary',
        chain: 'EVM',
        asset: 'ETH',
        network: 'ETH',
        from: '0x0000000000000000000000000000000000000001',
        to: '0x0000000000000000000000000000000000000002',
        amount: '0.01',
      });

      await TransactionLifecycleService.transition(hash, 'SIGNED');
      await TransactionLifecycleService.transition(hash, 'BROADCASTING');

      if (initialState !== 'BROADCASTING') {
        await TransactionLifecycleService.transition(hash, 'BROADCAST_ACCEPTED');
        await TransactionLifecycleService.transition(hash, initialState);
      }

      return hash;
    };

    try {
      // 1. A pending transaction becomes confirmed.
      {
        const hash = await makeRecord('confirm-me', 'PENDING');
        reconcileResponder = async (h) => ({
          transactionHash: h,
          status: 'CONFIRMED',
          blockNumber: 100,
          confirmations: 3,
          observedAt: new Date().toISOString(),
        });

        const result = await BroadcastService.recoverPersisted(hash);
        const record = await TransactionLifecycleService.get(hash);

        check(
          'PENDING_BECOMES_CONFIRMED',
          result.ok && result.reconciliation.status === 'CONFIRMED' && record?.state === 'CONFIRMED' && record?.blockNumber === 100,
          `Expected ok:true, status CONFIRMED, persisted state CONFIRMED. Got result=${JSON.stringify(result)}, record.state=${record?.state}.`
        );

        // 12. Persisted lifecycle records are refreshed correctly after reconciliation.
        check(
          'PERSISTED_RECORD_REFRESHED_AFTER_RECONCILE',
          record?.confirmations === 3 && record?.blockNumber === 100,
          `Expected persisted record to carry the new blockNumber/confirmations. Got blockNumber=${record?.blockNumber}, confirmations=${record?.confirmations}.`
        );
      }

      // 2. A pending transaction remains pending.
      {
        const hash = await makeRecord('stay-pending', 'PENDING');
        reconcileResponder = async (h) => ({
          transactionHash: h,
          status: 'PENDING',
          observedAt: new Date().toISOString(),
        });

        const result = await BroadcastService.recoverPersisted(hash);
        const record = await TransactionLifecycleService.get(hash);

        check(
          'PENDING_STAYS_PENDING',
          result.ok && !result.alreadyTerminal && result.reconciliation.status === 'PENDING' && record?.state === 'PENDING',
          `Expected PENDING to remain PENDING. Got result=${JSON.stringify(result)}, record.state=${record?.state}.`
        );
      }

      // 3. An unknown transaction remains unknown when no reliable result exists.
      {
        const hash = await makeRecord('stay-unknown', 'UNKNOWN');
        reconcileResponder = async (h) => ({
          transactionHash: h,
          status: 'UNKNOWN',
          observedAt: new Date().toISOString(),
        });

        const result = await BroadcastService.recoverPersisted(hash);
        const record = await TransactionLifecycleService.get(hash);

        check(
          'UNKNOWN_STAYS_UNKNOWN_NOT_FAILED',
          result.ok && result.reconciliation.status === 'UNKNOWN' && record?.state === 'UNKNOWN',
          `UNKNOWN must never become FAILED. Got result=${JSON.stringify(result)}, record.state=${record?.state}.`
        );
      }

      // 4. A confirmed receipt is not overwritten by a weaker result.
      {
        const hash = await makeRecord('already-confirmed', 'CONFIRMED');
        await TransactionLifecycleService.transition(hash, 'CONFIRMED', { blockNumber: 50, confirmations: 10 });

        let providerCalledAfterTerminal = false;
        reconcileResponder = async (h) => {
          providerCalledAfterTerminal = true;
          return { transactionHash: h, status: 'UNKNOWN', observedAt: new Date().toISOString() };
        };

        const result = await BroadcastService.recoverPersisted(hash);
        const record = await TransactionLifecycleService.get(hash);

        check(
          'CONFIRMED_NEVER_DOWNGRADED_BY_WEAKER_RESULT',
          result.ok &&
            result.alreadyTerminal &&
            result.reconciliation.status === 'CONFIRMED' &&
            !providerCalledAfterTerminal &&
            record?.state === 'CONFIRMED' &&
            record?.blockNumber === 50,
          `A terminal CONFIRMED record must short-circuit before ever calling the provider again. Got result=${JSON.stringify(result)}, providerCalled=${providerCalledAfterTerminal}, record.state=${record?.state}.`
        );
      }

      // 4b. recoverPersisted() reports the authoritative persisted state,
      // not a stale provider observation, when the record becomes terminal
      // WHILE this call's own provider request is still in flight. This is
      // the realistic overlap: recoverPersisted() begins with a
      // non-terminal snapshot (passes its own early terminal check), then -
      // before its own transition() call lands - a separate concurrent
      // write (e.g. broadcast()'s own reconciliation loop confirming the
      // same transaction) makes the record CONFIRMED. The stale
      // PENDING/UNKNOWN observation this call is about to apply must be
      // rejected by TransactionLifecycleService.transition()'s terminal
      // guard, and recoverPersisted() must report that rejection
      // faithfully - never the stale observation it tried to apply.
      {
        const hash = await makeRecord('authoritative-report', 'PENDING');

        reconcileResponder = async (h) => {
          // Simulates another in-flight call (e.g. broadcast()'s own loop)
          // confirming this exact transaction while THIS call's provider
          // request is still outstanding.
          await TransactionLifecycleService.transition(h, 'CONFIRMED', {
            blockNumber: 900,
            confirmations: 7,
          });
          await sleep(5);

          // This call's own (now stale) observation of the chain.
          return { transactionHash: h, status: 'UNKNOWN', observedAt: new Date().toISOString() };
        };

        const result = await BroadcastService.recoverPersisted(hash);
        const persisted = await TransactionLifecycleService.get(hash);

        check(
          'RECOVER_PERSISTED_REPORTS_AUTHORITATIVE_STATE_NOT_STALE_OBSERVATION',
          result.ok &&
            result.reconciliation.status === 'CONFIRMED' &&
            result.reconciliation.blockNumber === 900 &&
            result.reconciliation.confirmations === 7 &&
            persisted?.state === 'CONFIRMED' &&
            persisted?.blockNumber === 900,
          `recoverPersisted() must report what was actually persisted (CONFIRMED), never the stale UNKNOWN observation that TransactionLifecycleService.transition() correctly rejected. Got result=${JSON.stringify(result)}, persisted.state=${persisted?.state}.`
        );
      }

      // 5. A failed receipt is represented correctly.
      {
        const hash = await makeRecord('will-fail', 'PENDING');
        reconcileResponder = async (h) => ({
          transactionHash: h,
          status: 'FAILED',
          blockNumber: 77,
          observedAt: new Date().toISOString(),
        });

        const result = await BroadcastService.recoverPersisted(hash);
        const record = await TransactionLifecycleService.get(hash);

        check(
          'FAILED_RECEIPT_REPRESENTED_CORRECTLY',
          result.ok && result.reconciliation.status === 'FAILED' && record?.state === 'FAILED',
          `Expected a real FAILED receipt to be recorded as FAILED. Got result=${JSON.stringify(result)}, record.state=${record?.state}.`
        );
      }

      // 6. RPC failure does not convert the record to FAILED.
      {
        const hash = await makeRecord('rpc-will-throw', 'PENDING');
        reconcileResponder = async () => {
          throw new Error('simulated RPC timeout');
        };

        const result = await BroadcastService.recoverPersisted(hash);
        const record = await TransactionLifecycleService.get(hash);

        check(
          'RPC_FAILURE_NEVER_BECOMES_FAILED',
          errorCodeOf(result) === 'PROVIDER_ERROR' && record?.state === 'RECONCILE_REQUIRED',
          `An RPC error must become RECONCILE_REQUIRED, never FAILED. Got result=${JSON.stringify(result)}, record.state=${record?.state}.`
        );
      }

      // 7. Automatic recovery does not start duplicate concurrent jobs.
      {
        const hashA = await makeRecord('bulk-a', 'PENDING');
        const hashB = await makeRecord('bulk-b', 'UNKNOWN');
        let callCount = 0;

        reconcileResponder = async (h) => {
          callCount += 1;
          await sleep(15);
          return { transactionHash: h, status: 'PENDING', observedAt: new Date().toISOString() };
        };

        const [resultsA, resultsB] = await Promise.all([
          BroadcastService.reconcileRecoverable(),
          BroadcastService.reconcileRecoverable(),
        ]);

        check(
          'CONCURRENT_RECOVERABLE_RUNS_SHARE_ONE_PASS',
          resultsA === resultsB,
          'Two concurrent reconcileRecoverable() calls must resolve to the exact same single-flight result, not run two independent passes.'
        );

        void hashA;
        void hashB;
        void callCount;
      }

      // 8. Manual recovery prevents duplicate actions for the same transaction.
      {
        const hash = await makeRecord('double-tap', 'PENDING');
        let callCount = 0;

        reconcileResponder = async (h) => {
          callCount += 1;
          await sleep(20);
          return { transactionHash: h, status: 'PENDING', observedAt: new Date().toISOString() };
        };

        const [first, second] = await Promise.all([
          BroadcastService.recoverPersisted(hash),
          BroadcastService.recoverPersisted(hash),
        ]);

        const inProgressCount = [first, second].filter((r) => errorCodeOf(r) === 'IN_PROGRESS').length;

        check(
          'DOUBLE_TAP_ON_SAME_HASH_IS_DEDUPED',
          callCount === 1 && inProgressCount === 1,
          `Exactly one of two concurrent calls for the same hash must reach the provider; the other must report IN_PROGRESS. Got providerCalls=${callCount}, inProgressCount=${inProgressCount}.`
        );
      }

      // 9. Startup recovery failure does not prevent the app from opening.
      {
        reconcileResponder = async () => {
          throw new Error('provider unreachable');
        };

        await makeRecord('startup-failure-case', 'PENDING');

        let threw = false;
        try {
          await BroadcastService.reconcileRecoverable();
        } catch {
          threw = true;
        }

        check(
          'STARTUP_RECOVERY_FAILURE_DOES_NOT_THROW',
          !threw,
          'reconcileRecoverable() must resolve (never reject) even when every provider call fails, so app startup is never blocked.'
        );
      }

      // 10. No recovery path signs or broadcasts a transaction.
      check(
        'NO_RECOVERY_PATH_EVER_BROADCASTS',
        broadcastCallCount === 0,
        `broadcastSignedTransaction must never be called from any reconciliation path. Call count: ${broadcastCallCount}.`
      );

      // 11. Unsupported provider reconciliation fails safely and visibly.
      {
        const hash = rawTxHash('unsupported-chain');
        await TransactionLifecycleService.create({
          transactionHash: hash,
          intentId: 'intent-unsupported',
          accountId: 'primary',
          chain: 'BITCOIN',
          asset: 'BTC',
          network: 'BTC',
          from: '1FromAddress',
          to: '1ToAddress',
          amount: '0.001',
        });
        await TransactionLifecycleService.transition(hash, 'SIGNED');
        await TransactionLifecycleService.transition(hash, 'BROADCASTING');
        await TransactionLifecycleService.transition(hash, 'PENDING');

        const result = await BroadcastService.recoverPersisted(hash);

        check(
          'UNSUPPORTED_CHAIN_FAILS_SAFELY',
          errorCodeOf(result) === 'UNSUPPORTED' &&
            BroadcastService.isReconciliationSupported('BTC') === false &&
            BroadcastService.isReconciliationSupported('ETH') === true,
          `BTC must be reported UNSUPPORTED (no live reconciliation provider), ETH must be supported. Got result=${JSON.stringify(result)}.`
        );
      }
    } finally {
      (ProviderFactory as unknown as { getProvider: typeof ProviderFactory.getProvider }).getProvider =
        originalGetProvider;
    }

    return {
      passed: checks.every((c) => c.passed),
      checks,
    };
  }
}
