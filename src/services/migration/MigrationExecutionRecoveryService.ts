import AsyncStorage from '@react-native-async-storage/async-storage';

export type MigrationRecoveryStatus =
  | 'SIGNED'
  | 'BROADCAST'
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'RECONCILE_REQUIRED';

export type MigrationRecoveryRecord = {
  intentId: string;
  accountId: string;
  sourceIdentityId: string;
  destinationIdentityId: string;
  transactionDigest: string;
  transactionHash?: string;
  status: MigrationRecoveryStatus;
  createdAt: string;
  updatedAt: string;
};

const KEY = '@ron1n/migration-execution-recovery/v1';

export class MigrationExecutionRecoveryService {
  private static async read(): Promise<MigrationRecoveryRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private static async write(records: MigrationRecoveryRecord[]): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(records.slice(0, 250)));
  }

  static async get(intentId: string): Promise<MigrationRecoveryRecord | null> {
    const records = await this.read();
    return records.find((record) => record.intentId === intentId) ?? null;
  }

  static async list(): Promise<MigrationRecoveryRecord[]> {
    return this.read();
  }

  static async upsert(
    input: Omit<MigrationRecoveryRecord, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
    }
  ): Promise<MigrationRecoveryRecord> {
    const records = await this.read();
    const now = new Date().toISOString();
    const existing = records.find((record) => record.intentId === input.intentId);

    const record: MigrationRecoveryRecord = {
      ...input,
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      updatedAt: now,
    };

    await this.write([
      record,
      ...records.filter((item) => item.intentId !== input.intentId),
    ]);

    return record;
  }

  static async mark(
    intentId: string,
    status: MigrationRecoveryStatus,
    transactionHash?: string
  ): Promise<MigrationRecoveryRecord | null> {
    const existing = await this.get(intentId);
    if (!existing) return null;

    return this.upsert({
      ...existing,
      status,
      transactionHash: transactionHash ?? existing.transactionHash,
    });
  }
}
