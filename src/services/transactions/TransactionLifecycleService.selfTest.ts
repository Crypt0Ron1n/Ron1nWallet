import { ethers } from 'ethers';

import { TransactionLifecycleService } from './TransactionLifecycleService';

export type TransactionLifecycleServiceSelfTestResult = {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

function rawTxHash(seed: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(seed));
}

async function makeConfirmedRecord(seed: string): Promise<string> {
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
  await TransactionLifecycleService.transition(hash, 'BROADCAST_ACCEPTED');
  await TransactionLifecycleService.transition(hash, 'PENDING');
  await TransactionLifecycleService.transition(hash, 'CONFIRMED', {
    blockNumber: 500,
    confirmations: 5,
  });

  return hash;
}

async function makeFailedRecord(seed: string): Promise<string> {
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
  await TransactionLifecycleService.transition(hash, 'BROADCAST_ACCEPTED');
  await TransactionLifecycleService.transition(hash, 'PENDING');
  await TransactionLifecycleService.transition(hash, 'FAILED', {
    blockNumber: 500,
  });

  return hash;
}

/**
 * Deterministic tests for the terminal-state integrity fix in
 * `TransactionLifecycleService.transition()`. Runs against the real,
 * unmodified service (backed by the project's AsyncStorage stub when run
 * standalone, or the real module on-device) - no parallel reimplementation,
 * no mocked lifecycle logic.
 */
export class TransactionLifecycleServiceSelfTestService {
  static async run(): Promise<TransactionLifecycleServiceSelfTestResult> {
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
    const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });

    // 1. CONFIRMED -> PENDING rejected/ignored.
    {
      const hash = await makeConfirmedRecord('confirmed-to-pending');
      const result = await TransactionLifecycleService.transition(hash, 'PENDING');
      const persisted = await TransactionLifecycleService.get(hash);

      check(
        'CONFIRMED_TO_PENDING_IGNORED',
        result?.state === 'CONFIRMED' && persisted?.state === 'CONFIRMED' && persisted?.blockNumber === 500,
        `A CONFIRMED record must stay CONFIRMED when a PENDING observation arrives. Got returned state=${result?.state}, persisted state=${persisted?.state}.`
      );
    }

    // 2. CONFIRMED -> UNKNOWN rejected/ignored.
    {
      const hash = await makeConfirmedRecord('confirmed-to-unknown');
      const result = await TransactionLifecycleService.transition(hash, 'UNKNOWN');
      const persisted = await TransactionLifecycleService.get(hash);

      check(
        'CONFIRMED_TO_UNKNOWN_IGNORED',
        result?.state === 'CONFIRMED' && persisted?.state === 'CONFIRMED',
        `A CONFIRMED record must stay CONFIRMED when an UNKNOWN observation arrives. Got returned state=${result?.state}, persisted state=${persisted?.state}.`
      );
    }

    // 3. CONFIRMED -> FAILED rejected/ignored.
    {
      const hash = await makeConfirmedRecord('confirmed-to-failed');
      const result = await TransactionLifecycleService.transition(hash, 'FAILED');
      const persisted = await TransactionLifecycleService.get(hash);

      check(
        'CONFIRMED_TO_FAILED_IGNORED',
        result?.state === 'CONFIRMED' && persisted?.state === 'CONFIRMED',
        `CONFIRMED must not be swappable to FAILED without a separately verified correction mechanism (none exists). Got returned state=${result?.state}, persisted state=${persisted?.state}.`
      );
    }

    // 4. FAILED -> PENDING rejected/ignored.
    {
      const hash = await makeFailedRecord('failed-to-pending');
      const result = await TransactionLifecycleService.transition(hash, 'PENDING');
      const persisted = await TransactionLifecycleService.get(hash);

      check(
        'FAILED_TO_PENDING_IGNORED',
        result?.state === 'FAILED' && persisted?.state === 'FAILED',
        `A FAILED record must stay FAILED when a PENDING observation arrives. Got returned state=${result?.state}, persisted state=${persisted?.state}.`
      );
    }

    // 5. FAILED -> CONFIRMED rejected/ignored.
    {
      const hash = await makeFailedRecord('failed-to-confirmed');
      const result = await TransactionLifecycleService.transition(hash, 'CONFIRMED', { blockNumber: 999 });
      const persisted = await TransactionLifecycleService.get(hash);

      check(
        'FAILED_TO_CONFIRMED_IGNORED',
        result?.state === 'FAILED' && persisted?.state === 'FAILED' && persisted?.blockNumber !== 999,
        `FAILED must not be swappable to CONFIRMED without a separately verified correction mechanism (none exists). Got returned state=${result?.state}, persisted state=${persisted?.state}, blockNumber=${persisted?.blockNumber}.`
      );
    }

    // 6. Repeated CONFIRMED -> CONFIRMED remains idempotent.
    {
      const hash = await makeConfirmedRecord('repeat-confirmed');
      const result = await TransactionLifecycleService.transition(hash, 'CONFIRMED', {
        blockNumber: 500,
        confirmations: 12,
      });
      const persisted = await TransactionLifecycleService.get(hash);

      check(
        'REPEATED_CONFIRMED_IS_IDEMPOTENT',
        result?.state === 'CONFIRMED' && persisted?.state === 'CONFIRMED' && persisted?.confirmations === 12,
        `A repeated CONFIRMED observation must stay CONFIRMED (and may refresh confirmations). Got state=${persisted?.state}, confirmations=${persisted?.confirmations}.`
      );
    }

    // 7. Repeated FAILED -> FAILED remains idempotent.
    {
      const hash = await makeFailedRecord('repeat-failed');
      const result = await TransactionLifecycleService.transition(hash, 'FAILED', { blockNumber: 500 });
      const persisted = await TransactionLifecycleService.get(hash);

      check(
        'REPEATED_FAILED_IS_IDEMPOTENT',
        result?.state === 'FAILED' && persisted?.state === 'FAILED',
        `A repeated FAILED observation must stay FAILED. Got state=${persisted?.state}.`
      );
    }

    // 8. Concurrent terminal + stale non-terminal transitions preserve the terminal state.
    {
      const hash = rawTxHash('concurrent-race');

      await TransactionLifecycleService.create({
        transactionHash: hash,
        intentId: 'intent-concurrent-race',
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
      await TransactionLifecycleService.transition(hash, 'BROADCAST_ACCEPTED');
      await TransactionLifecycleService.transition(hash, 'PENDING');

      // Two independent async call chains "racing" on the same hash -
      // simulates broadcast()'s own reconciliation loop confirming a
      // transaction at the same time a separate recoverPersisted() call
      // (e.g. a manual Activity tap) is mid-flight with a stale PENDING/
      // UNKNOWN observation of the same transaction. Fired together via
      // Promise.all so both are genuinely in-flight concurrently; the
      // module's internal write queue is what decides the real
      // application order, not this test.
      const [confirmResult, staleResult] = await Promise.all([
        TransactionLifecycleService.transition(hash, 'CONFIRMED', { blockNumber: 777, confirmations: 1 }),
        TransactionLifecycleService.transition(hash, 'UNKNOWN'),
      ]);

      const persisted = await TransactionLifecycleService.get(hash);

      check(
        'CONCURRENT_RACE_PRESERVES_CONFIRMED',
        persisted?.state === 'CONFIRMED' &&
          persisted?.blockNumber === 777 &&
          confirmResult?.state === 'CONFIRMED' &&
          staleResult?.state === 'CONFIRMED',
        `Regardless of which of two concurrent transition() calls "wins" the race, the final persisted state must be CONFIRMED, never UNKNOWN. Got persisted.state=${persisted?.state}, confirmResult.state=${confirmResult?.state}, staleResult.state=${staleResult?.state}.`
      );
    }

    // 9. Existing valid (non-terminal-involving) transitions still work.
    {
      const hash = rawTxHash('valid-happy-path');

      const created = await TransactionLifecycleService.create({
        transactionHash: hash,
        intentId: 'intent-happy-path',
        accountId: 'primary',
        chain: 'EVM',
        asset: 'ETH',
        network: 'ETH',
        from: '0x0000000000000000000000000000000000000001',
        to: '0x0000000000000000000000000000000000000002',
        amount: '0.01',
      });

      const signed = await TransactionLifecycleService.transition(hash, 'SIGNED');
      const broadcasting = await TransactionLifecycleService.transition(hash, 'BROADCASTING');
      const pending = await TransactionLifecycleService.transition(hash, 'PENDING');
      const confirmed = await TransactionLifecycleService.transition(hash, 'CONFIRMED', {
        blockNumber: 42,
        confirmations: 1,
      });

      check(
        'EXISTING_VALID_TRANSITIONS_STILL_WORK',
        created.state === 'CREATED' &&
          signed?.state === 'SIGNED' &&
          broadcasting?.state === 'BROADCASTING' &&
          pending?.state === 'PENDING' &&
          confirmed?.state === 'CONFIRMED' &&
          confirmed?.blockNumber === 42,
        `The normal CREATED->SIGNED->BROADCASTING->PENDING->CONFIRMED path must be unaffected. Got states=[${created.state},${signed?.state},${broadcasting?.state},${pending?.state},${confirmed?.state}].`
      );
    }

    // Unrelated-record isolation: a transition for one hash must never
    // corrupt or lose a concurrently-written, unrelated hash's record
    // (the general lost-update risk of the shared single-blob store).
    {
      const hashA = rawTxHash('isolation-a');
      const hashB = rawTxHash('isolation-b');

      await TransactionLifecycleService.create({
        transactionHash: hashA,
        intentId: 'intent-isolation-a',
        accountId: 'primary',
        chain: 'EVM',
        asset: 'ETH',
        network: 'ETH',
        from: '0x1',
        to: '0x2',
        amount: '0.01',
      });
      await TransactionLifecycleService.create({
        transactionHash: hashB,
        intentId: 'intent-isolation-b',
        accountId: 'primary',
        chain: 'EVM',
        asset: 'ETH',
        network: 'ETH',
        from: '0x1',
        to: '0x2',
        amount: '0.02',
      });

      await Promise.all([
        TransactionLifecycleService.transition(hashA, 'CONFIRMED', { blockNumber: 1 }),
        TransactionLifecycleService.transition(hashB, 'CONFIRMED', { blockNumber: 2 }),
      ]);

      const recordA = await TransactionLifecycleService.get(hashA);
      const recordB = await TransactionLifecycleService.get(hashB);

      check(
        'CONCURRENT_WRITES_TO_DIFFERENT_HASHES_DO_NOT_LOSE_EACH_OTHER',
        recordA?.state === 'CONFIRMED' && recordA?.blockNumber === 1 && recordB?.state === 'CONFIRMED' && recordB?.blockNumber === 2,
        `Two concurrent transition() calls for different hashes must both be persisted - neither should be lost to the shared single-blob store. Got A=${JSON.stringify(recordA)}, B=${JSON.stringify(recordB)}.`
      );
    }

    return {
      passed: checks.every((c) => c.passed),
      checks,
    };
  }
}
