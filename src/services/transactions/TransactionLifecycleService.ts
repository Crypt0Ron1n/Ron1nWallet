import AsyncStorage from '@react-native-async-storage/async-storage';

export type TransactionLifecycleState =
  | 'CREATED'
  | 'SIGNED'
  | 'BROADCASTING'
  | 'BROADCAST_ACCEPTED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'RECONCILE_REQUIRED';

export type PersistedTransactionLifecycle = {
  transactionHash: string;
  intentId: string;
  accountId: string;
  chain: string;
  asset: string;
  network?: string;
  from: string;
  to: string;
  amount: string;
  nonce?: number;
  /**
   * Exact signed raw transaction bytes (0x-prefixed hex), persisted so a
   * pending/unknown transaction can be reconciled or deliberately rebroadcast
   * after an app restart without re-signing. Never log this value and never
   * surface it to the UI - it is recovery-path state, not display data. It
   * never contains private keys, mnemonics, or other signing material -
   * only the already-signed transaction payload.
   */
  rawTransaction?: string;
  state: TransactionLifecycleState;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  blockNumber?: number;
  confirmations?: number;
};

const STORAGE_KEY = '@ron1n/transaction-lifecycle/v1';

/**
 * CONFIRMED and FAILED are final: the chain has already produced its
 * verdict. Moving between them, or back to any non-terminal state, would
 * require a separately verified correction mechanism this service does not
 * implement.
 */
const TERMINAL_STATES: ReadonlySet<TransactionLifecycleState> = new Set([
  'CONFIRMED',
  'FAILED',
]);

/**
 * `readAll`/`writeAll` operate on one shared JSON blob (AsyncStorage has no
 * per-record atomic update), so two concurrent read-modify-write cycles -
 * for the same transaction hash or different ones - can silently lose an
 * update: whichever call's write lands second overwrites the array with a
 * copy that never saw the first call's change. This in-process queue
 * serializes every mutation through this module so each one always reads
 * the result of every previously-enqueued mutation before deciding what to
 * write, closing that race within this app's single JS execution model.
 * It only serializes access *within this process* - it is not a
 * cross-process/multi-device lock, which AsyncStorage cannot provide.
 */
let writeQueue: Promise<void> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readAll(): Promise<PersistedTransactionLifecycle[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is PersistedTransactionLifecycle =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as PersistedTransactionLifecycle).transactionHash === 'string' &&
        typeof (entry as PersistedTransactionLifecycle).intentId === 'string' &&
        typeof (entry as PersistedTransactionLifecycle).state === 'string'
    );
  } catch {
    return [];
  }
}

async function writeAll(
  records: PersistedTransactionLifecycle[]
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export class TransactionLifecycleService {
  static async create(input: Omit<PersistedTransactionLifecycle, 'createdAt' | 'updatedAt' | 'state'>): Promise<PersistedTransactionLifecycle> {
    return enqueue(async () => {
      const now = new Date().toISOString();
      const record: PersistedTransactionLifecycle = {
        ...input,
        state: 'CREATED',
        createdAt: now,
        updatedAt: now,
      };

      const records = await readAll();
      const existing = records.find(
        (item) => item.transactionHash.toLowerCase() === input.transactionHash.toLowerCase()
      );

      if (existing) return existing;

      await writeAll([record, ...records].slice(0, 100));
      return record;
    });
  }

  /**
   * Applies a lifecycle transition, serialized against every other
   * create/transition call so the read-check-write sequence below can
   * never be interleaved with a concurrent one for the same (or any other)
   * record.
   *
   * Once a record is CONFIRMED or FAILED, only an identical repeat of that
   * same terminal state is honored - a later, weaker observation
   * (PENDING/UNKNOWN/BROADCASTING/RECONCILE_REQUIRED) or the opposite
   * terminal state is safely ignored, returning the unchanged authoritative
   * record rather than throwing, so every existing caller (none of which
   * inspect this return value today) keeps compiling and behaving exactly
   * as before.
   */
  static async transition(
    transactionHash: string,
    state: TransactionLifecycleState,
    metadata: Partial<
      Pick<PersistedTransactionLifecycle, 'lastError' | 'blockNumber' | 'confirmations'>
    > = {}
  ): Promise<PersistedTransactionLifecycle | null> {
    return enqueue(async () => {
      const records = await readAll();
      const index = records.findIndex(
        (item) =>
          item.transactionHash.toLowerCase() === transactionHash.toLowerCase()
      );

      if (index < 0) return null;

      const current = records[index];

      if (TERMINAL_STATES.has(current.state) && state !== current.state) {
        return current;
      }

      const updated: PersistedTransactionLifecycle = {
        ...current,
        ...metadata,
        state,
        updatedAt: new Date().toISOString(),
      };

      records[index] = updated;
      await writeAll(records);
      return updated;
    });
  }

  static async get(
    transactionHash: string
  ): Promise<PersistedTransactionLifecycle | null> {
    const records = await readAll();
    return (
      records.find(
        (item) =>
          item.transactionHash.toLowerCase() === transactionHash.toLowerCase()
      ) ?? null
    );
  }

  /**
   * Read-only listing of every persisted lifecycle record, terminal or not.
   * Added for the Activity UI (Phase 3) so PENDING/CONFIRMED/FAILED/UNKNOWN/
   * RECONCILE_REQUIRED transactions are actually visible somewhere - this
   * state existed since Phase 1 but had no UI consumer. Pure read, no new
   * state, no mutation; does not change create/transition/reconcile behavior.
   */
  static async listAll(): Promise<PersistedTransactionLifecycle[]> {
    return readAll();
  }

  static async listRecoverable(): Promise<PersistedTransactionLifecycle[]> {
    const records = await readAll();
    return records.filter((item) =>
      ['BROADCASTING', 'BROADCAST_ACCEPTED', 'PENDING', 'UNKNOWN', 'RECONCILE_REQUIRED'].includes(
        item.state
      )
    );
  }

  static async markReconcileRequired(
    transactionHash: string,
    reason?: string
  ): Promise<PersistedTransactionLifecycle | null> {
    return this.transition(transactionHash, 'RECONCILE_REQUIRED', {
      lastError: reason,
    });
  }

  static async clearTerminalHistory(
    maxAgeMs = 30 * 24 * 60 * 60 * 1000
  ): Promise<void> {
    return enqueue(async () => {
      const cutoff = Date.now() - maxAgeMs;
      const records = await readAll();

      const retained = records.filter((item) => {
        const terminal =
          item.state === 'CONFIRMED' || item.state === 'FAILED';
        return !terminal || Date.parse(item.updatedAt) >= cutoff;
      });

      await writeAll(retained);
    });
  }
}
