import type { SupportedChain } from '../crypto/types';
import { IdentityRegistryService, type ShogunIdentityRecord } from '../identity/IdentityRegistryService';
import { WalletService } from '../WalletService';
import { PrivacyAssessmentService } from './PrivacyAssessmentService';
import { PrivacyStrategyRegistry } from './PrivacyStrategyRegistry';
import type { PrivacyAssessment } from './PrivacyTypes';

export type AssetProtectionStatus = {
  receiveIdentity: ShogunIdentityRecord | null;
  holdingIdentity: ShogunIdentityRecord | null;
  spendIdentity: ShogunIdentityRecord | null;
  assessment: PrivacyAssessment;
};

export type PrivacyProtectionRequestResult = {
  status: 'NOT_IMPLEMENTED' | 'BLOCKED';
  reason: string;
};

function nextIndex(identities: ShogunIdentityRecord[]): number {
  if (identities.length === 0) return 1;
  return Math.max(...identities.map((identity) => identity.index)) + 1;
}

/**
 * Public-address derivation only - every branch calls the same
 * CryptoCore-backed WalletService wrappers ReceiveIdentityService already
 * uses. No secret material crosses this boundary.
 */
async function derivePublicAddress(chain: SupportedChain, index: number) {
  switch (chain) {
    case 'EVM':
      return WalletService.getEthereumWallet(index);
    case 'BITCOIN':
      return WalletService.getBitcoinWallet(index);
    case 'LITECOIN':
      return WalletService.getLitecoinWallet(index);
    case 'SOLANA':
      return WalletService.getSolanaWallet(index);
    case 'XRP':
      return WalletService.getXrpWallet(index);
    case 'STELLAR':
      return WalletService.getStellarWallet(index);
    case 'ALGORAND':
      return WalletService.getAlgorandWallet(index);
    default:
      throw new Error(`Unsupported chain for holding identity derivation: ${chain}`);
  }
}

/**
 * Represents the user's decision to protect an asset after receipt.
 *
 * RECEIVE -> RECEIVE IDENTITY -> PRIVACY ASSESSMENT -> USER DECISION -> KEEP / SEPARATE / PROTECT
 *
 * This service never moves funds, signs, or broadcasts, and never reads
 * secret material. Reserving a holding identity only derives a public
 * address and writes local non-secret registry metadata - the same boundary
 * ReceiveIdentityService already uses for receive identities. Any actual
 * asset movement must go through the existing TransactionIntent /
 * SecurityPolicyEngine / CryptoCore / BroadcastService pipeline, started
 * explicitly by the user - never automatically from here.
 */
export class AssetProtectionService {
  static async getStatus(
    accountId: string,
    chain: SupportedChain,
    asset: string,
    receiveAddress: string
  ): Promise<AssetProtectionStatus> {
    const identities = await IdentityRegistryService.list(accountId, chain);
    const normalized = receiveAddress.trim().toLowerCase();

    const receiveIdentity =
      identities.find(
        (identity) => identity.purpose === 'INGRESS' && identity.address.toLowerCase() === normalized
      ) ?? null;

    const holdingIdentity = receiveIdentity
      ? identities.find(
          (identity) =>
            identity.purpose === 'VAULT' && identity.linkedIdentityId === receiveIdentity.identityId
        ) ?? null
      : null;

    const spendIdentity =
      identities.find((identity) => identity.purpose === 'SPEND' && identity.lifecycle === 'ACTIVE') ??
      null;

    const assessment = await PrivacyAssessmentService.assess(accountId, chain, asset, receiveAddress);

    return { receiveIdentity, holdingIdentity, spendIdentity, assessment };
  }

  /**
   * SEPARATE_ASSET / CREATE_FRESH_IDENTITY action: reserves a fresh holding
   * (VAULT-purpose) identity linked to the receive identity. Pure local
   * bookkeeping - derives a public address and activates a registry record.
   * Does not move any funds and does not construct, sign, or broadcast a
   * transaction.
   */
  static async createHoldingIdentity(
    accountId: string,
    chain: SupportedChain,
    receiveAddress: string
  ): Promise<ShogunIdentityRecord> {
    const normalized = receiveAddress.trim();

    if (!accountId.trim() || !normalized) {
      throw new Error('Creating a holding identity requires an account and receive address.');
    }

    const identities = await IdentityRegistryService.list(accountId, chain);

    const receiveIdentity = identities.find(
      (identity) => identity.purpose === 'INGRESS' && identity.address.toLowerCase() === normalized.toLowerCase()
    );

    if (!receiveIdentity) {
      throw new Error('No registered receive identity was found for this address.');
    }

    const existingHolding = identities.find(
      (identity) => identity.purpose === 'VAULT' && identity.linkedIdentityId === receiveIdentity.identityId
    );

    if (existingHolding) {
      return existingHolding;
    }

    const index = nextIndex(identities);
    const derived = await derivePublicAddress(chain, index);

    const reserved = await IdentityRegistryService.reserve({
      accountId,
      chain,
      purpose: 'VAULT',
      index,
      address: derived.address,
      linkedIdentityId: receiveIdentity.identityId,
    });

    const activated = await IdentityRegistryService.activate(reserved.identityId);
    return activated ?? reserved;
  }

  /**
   * PRIVACY_PROTOCOL action. No privacy protocol is implemented for any
   * chain yet, so this always honestly refuses rather than fabricating a
   * route, a "protected" state, or falling back to address separation
   * without telling the user.
   */
  static async requestPrivacyProtection(chain: SupportedChain): Promise<PrivacyProtectionRequestResult> {
    const capabilities = PrivacyStrategyRegistry.get(chain).getCapabilities();
    const route = capabilities.capabilities.PRIVACY_ROUTE;

    if (route.availability === 'AVAILABLE' || route.availability === 'LIMITED') {
      // No chain currently reports this. Reaching here would mean a future
      // strategy claims protocol support with no execution path behind it -
      // refuse rather than silently proceeding or faking success.
      return {
        status: 'BLOCKED',
        reason: 'A privacy route was reported available, but no execution path is implemented yet.',
      };
    }

    return { status: 'NOT_IMPLEMENTED', reason: route.explanation };
  }
}
