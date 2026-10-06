import type { SupportedChain } from '../crypto/types';
import {
  type AssetMigrationAdapterRegistration,
  type AssetMigrationPlan,
  type AssetMigrationRequest,
  type ChainMigrationAdapter,
} from './types';

const SUPPORTED_CHAINS: SupportedChain[] = [
  'EVM',
  'SOLANA',
  'BITCOIN',
  'LITECOIN',
  'XRP',
  'STELLAR',
  'ALGORAND',
];

function invalidPlan(
  request: AssetMigrationRequest,
  reason: string
): AssetMigrationPlan {
  return {
    status: 'INVALID',
    chain: request.intent.asset.chain,
    accountId: request.accountId,
    intentId: request.intent.intentId,
    intent: request.intent,
    sourceIdentityId: request.sourceIdentity.identityId,
    destinationIdentityId: request.destinationIdentity.identityId,
    sourceAddress: request.sourceIdentity.address,
    destinationAddress: request.destinationIdentity.address,
    reason,
    requiresUserAuthorization: false,
    requiresBiometricAuthorization: false,
    canExecute: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Universal migration planning boundary.
 *
 * This layer owns validation and adapter selection only. It never handles
 * secrets, signs transactions, broadcasts transactions, or retires identities.
 */
export class AssetMigrationEngine {
  private static readonly adapters = new Map<
    SupportedChain,
    AssetMigrationAdapterRegistration
  >();

  static registerAdapter(
    adapter: ChainMigrationAdapter,
    enabled = true
  ): void {
    this.adapters.set(adapter.chain, { adapter, enabled });
  }

  static unregisterAdapter(chain: SupportedChain): void {
    this.adapters.delete(chain);
  }

  static hasAdapter(chain: SupportedChain): boolean {
    const registration = this.adapters.get(chain);
    return Boolean(registration?.enabled);
  }

  static getSupportedChains(): SupportedChain[] {
    return [...SUPPORTED_CHAINS];
  }

  static async prepare(
    request: AssetMigrationRequest
  ): Promise<AssetMigrationPlan> {
    const intent = request.intent;

    if (!request.accountId.trim()) {
      return invalidPlan(request, 'Migration account ID is required.');
    }

    if (!intent.intentId.trim()) {
      return invalidPlan(request, 'Migration intent ID is required.');
    }

    if (intent.accountId !== request.accountId) {
      return invalidPlan(
        request,
        'Migration account does not match the transaction intent.'
      );
    }

    if (
      request.sourceIdentity.accountId !== request.accountId ||
      request.destinationIdentity.accountId !== request.accountId
    ) {
      return invalidPlan(
        request,
        'Migration identities must belong to the same account as the intent.'
      );
    }

    if (
      request.sourceIdentity.chain !== intent.asset.chain ||
      request.destinationIdentity.chain !== intent.asset.chain
    ) {
      return invalidPlan(
        request,
        'Migration identity chain does not match the transaction intent.'
      );
    }

    if (
      request.sourceIdentity.identityId ===
      request.destinationIdentity.identityId
    ) {
      return invalidPlan(
        request,
        'Migration source and destination identities must be different.'
      );
    }

    if (
      request.sourceIdentity.address.trim().toLowerCase() ===
      request.destinationIdentity.address.trim().toLowerCase()
    ) {
      return invalidPlan(
        request,
        'Migration source and destination addresses must be different.'
      );
    }

    if (request.sourceIdentity.lifecycle !== 'ACTIVE') {
      return invalidPlan(
        request,
        'Migration source identity must be ACTIVE.'
      );
    }

    if (request.destinationIdentity.lifecycle !== 'RESERVED') {
      return invalidPlan(
        request,
        'Migration destination identity must be RESERVED.'
      );
    }

    const registration = this.adapters.get(intent.asset.chain);

    if (!registration?.enabled) {
      return {
        ...invalidPlan(
          request,
          `No enabled migration adapter exists for ${intent.asset.chain}.`
        ),
        status: 'UNSUPPORTED',
      };
    }

    if (!registration.adapter.supports(request)) {
      return {
        ...invalidPlan(
          request,
          `The ${intent.asset.chain} migration adapter does not support this asset migration.`
        ),
        status: 'UNSUPPORTED',
      };
    }

    try {
      const plan = await registration.adapter.prepare(request);

      if (plan.chain !== intent.asset.chain) {
        return invalidPlan(
          request,
          'Migration adapter returned a mismatched chain.'
        );
      }

      if (plan.intentId !== intent.intentId) {
        return invalidPlan(
          request,
          'Migration adapter returned a mismatched intent.'
        );
      }

      if (
        plan.sourceIdentityId !== request.sourceIdentity.identityId ||
        plan.destinationIdentityId !== request.destinationIdentity.identityId
      ) {
        return invalidPlan(
          request,
          'Migration adapter returned mismatched identity references.'
        );
      }

      return plan;
    } catch (error) {
      return {
        ...invalidPlan(
          request,
          error instanceof Error
            ? error.message
            : 'Migration adapter failed during planning.'
        ),
        status: 'BLOCKED',
      };
    }
  }
}
