import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedChain } from '../crypto/types';

export type IdentityPurpose = 'INGRESS' | 'VAULT' | 'SPEND' | 'RECOVERY';

export type IdentityLifecycle =
  | 'RESERVED'
  | 'ACTIVE'
  | 'USED'
  | 'RETIRED'
  | 'FAILED'
  | 'ABANDONED';

export type ShogunIdentityRecord = {
  identityId: string;
  accountId: string;
  chain: SupportedChain;
  purpose: IdentityPurpose;
  index: number;
  address: string;
  lifecycle: IdentityLifecycle;
  createdAt: string;
  activatedAt?: string;
  retiredAt?: string;
  exposureLevel?: 'FRESH' | 'LOW' | 'ELEVATED' | 'UNKNOWN';
  /**
   * Optional reference to another identity this one relates to - e.g. a
   * VAULT (holding) identity reserved to protect assets originally received
   * at a specific INGRESS identity. Purely descriptive local metadata; it
   * does not imply any on-chain relationship beyond what each address's own
   * transaction history actually shows.
   */
  linkedIdentityId?: string;
};

const STORAGE_KEY = '@ron1n/identity-registry/v1';

async function readAll(): Promise<ShogunIdentityRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (value): value is ShogunIdentityRecord =>
        !!value &&
        typeof value === 'object' &&
        typeof (value as ShogunIdentityRecord).identityId === 'string' &&
        typeof (value as ShogunIdentityRecord).accountId === 'string' &&
        typeof (value as ShogunIdentityRecord).chain === 'string' &&
        typeof (value as ShogunIdentityRecord).purpose === 'string' &&
        typeof (value as ShogunIdentityRecord).address === 'string' &&
        typeof (value as ShogunIdentityRecord).index === 'number'
    );
  } catch {
    return [];
  }
}

async function writeAll(records: ShogunIdentityRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export class IdentityRegistryService {
  static async reserve(
    input: Omit<
      ShogunIdentityRecord,
      'identityId' | 'lifecycle' | 'createdAt'
    >
  ): Promise<ShogunIdentityRecord> {
    const records = await readAll();

    const duplicate = records.find(
      (record) =>
        record.accountId === input.accountId &&
        record.chain === input.chain &&
        record.address.toLowerCase() === input.address.toLowerCase()
    );

    if (duplicate) return duplicate;

    const record: ShogunIdentityRecord = {
      ...input,
      identityId: `identity-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`,
      lifecycle: 'RESERVED',
      createdAt: new Date().toISOString(),
    };

    await writeAll([record, ...records]);
    return record;
  }

  static async activate(
    identityId: string
  ): Promise<ShogunIdentityRecord | null> {
    const records = await readAll();
    const index = records.findIndex((record) => record.identityId === identityId);
    if (index < 0) return null;

    const current = records[index];
    const updated: ShogunIdentityRecord = {
      ...current,
      lifecycle: 'ACTIVE',
      activatedAt: current.activatedAt ?? new Date().toISOString(),
    };

    records[index] = updated;
    await writeAll(records);
    return updated;
  }

  static async markUsed(
    identityId: string
  ): Promise<ShogunIdentityRecord | null> {
    return this.transition(identityId, 'USED');
  }

  static async retire(
    identityId: string
  ): Promise<ShogunIdentityRecord | null> {
    const records = await readAll();
    const index = records.findIndex((record) => record.identityId === identityId);
    if (index < 0) return null;

    const current = records[index];
    const updated: ShogunIdentityRecord = {
      ...current,
      lifecycle: 'RETIRED',
      retiredAt: new Date().toISOString(),
    };

    records[index] = updated;
    await writeAll(records);
    return updated;
  }

  static async transition(
    identityId: string,
    lifecycle: IdentityLifecycle
  ): Promise<ShogunIdentityRecord | null> {
    const records = await readAll();
    const index = records.findIndex((record) => record.identityId === identityId);
    if (index < 0) return null;

    records[index] = {
      ...records[index],
      lifecycle,
    };

    await writeAll(records);
    return records[index];
  }

  static async updateExposure(
    identityId: string,
    exposureLevel: ShogunIdentityRecord['exposureLevel']
  ): Promise<ShogunIdentityRecord | null> {
    const records = await readAll();
    const index = records.findIndex((record) => record.identityId === identityId);
    if (index < 0) return null;

    records[index] = {
      ...records[index],
      exposureLevel,
    };

    await writeAll(records);
    return records[index];
  }

  static async get(identityId: string): Promise<ShogunIdentityRecord | null> {
    const records = await readAll();
    return records.find((record) => record.identityId === identityId) ?? null;
  }

  static async list(
    accountId: string,
    chain?: SupportedChain
  ): Promise<ShogunIdentityRecord[]> {
    const records = await readAll();

    return records.filter(
      (record) =>
        record.accountId === accountId &&
        (!chain || record.chain === chain)
    );
  }

  static async findActive(
    accountId: string,
    chain: SupportedChain,
    purpose: IdentityPurpose
  ): Promise<ShogunIdentityRecord | null> {
    const records = await readAll();

    return (
      records.find(
        (record) =>
          record.accountId === accountId &&
          record.chain === chain &&
          record.purpose === purpose &&
          record.lifecycle === 'ACTIVE'
      ) ?? null
    );
  }
}
