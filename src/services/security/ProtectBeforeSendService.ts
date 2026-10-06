import type { SupportedChain } from '../crypto/types';
import {
  IdentityRegistryService,
  type ShogunIdentityRecord,
} from '../identity/IdentityRegistryService';

export type ProtectBeforeSendStatus =
  | 'REQUIRED'
  | 'READY'
  | 'UNREGISTERED'
  | 'BLOCKED';

export type ProtectBeforeSendAssessment = {
  status: ProtectBeforeSendStatus;
  sourceIdentity: ShogunIdentityRecord | null;
  reason: string;
  requiresMigration: boolean;
  requiresFreshSpendIdentity: boolean;
};

/**
 * Application-level guard for outbound identity hygiene.
 *
 * Receiving is allowed to use an INGRESS identity without migration.
 * Outbound spending from an INGRESS identity is not allowed directly.
 *
 * This service intentionally does NOT move funds and does NOT sign
 * transactions. Chain-specific migration belongs in the migration engine.
 */
export class ProtectBeforeSendService {
  static async assess(
    accountId: string,
    chain: SupportedChain,
    sourceAddress: string
  ): Promise<ProtectBeforeSendAssessment> {
    const normalizedAddress = sourceAddress.trim().toLowerCase();

    if (!accountId.trim() || !normalizedAddress) {
      return {
        status: 'BLOCKED',
        sourceIdentity: null,
        reason: 'A valid account and source address are required.',
        requiresMigration: false,
        requiresFreshSpendIdentity: false,
      };
    }

    const identities = await IdentityRegistryService.list(accountId, chain);

    const sourceIdentity =
      identities.find(
        (identity) =>
          identity.address.trim().toLowerCase() === normalizedAddress &&
          identity.lifecycle === 'ACTIVE'
      ) ?? null;

    if (!sourceIdentity) {
      return {
        status: 'UNREGISTERED',
        sourceIdentity: null,
        reason:
          'The source identity is not registered. Register it before outbound authorization.',
        requiresMigration: true,
        requiresFreshSpendIdentity: true,
      };
    }

    if (sourceIdentity.purpose === 'INGRESS') {
      return {
        status: 'REQUIRED',
        sourceIdentity,
        reason:
          'Ingress identities are receive-only. Protect Before Send requires a fresh spend identity and chain-specific asset migration before outbound authorization.',
        requiresMigration: true,
        requiresFreshSpendIdentity: true,
      };
    }

    if (sourceIdentity.purpose === 'SPEND') {
      return {
        status: 'READY',
        sourceIdentity,
        reason: 'Source is an active spend identity.',
        requiresMigration: false,
        requiresFreshSpendIdentity: false,
      };
    }

    return {
      status: 'BLOCKED',
      sourceIdentity,
      reason:
        'This identity purpose is not authorized for direct outbound spending.',
      requiresMigration: true,
      requiresFreshSpendIdentity: true,
    };
  }
}
