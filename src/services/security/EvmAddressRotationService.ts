import { ethers } from 'ethers';

import type { SecurityProfile } from '../transactions/TransactionIntent';
import { createTransactionIntentId, type TransactionIntent } from '../transactions/TransactionIntent';
import { TransactionConstructionService } from '../transactions/TransactionConstructionService';
import { NetworkStateService } from '../network/NetworkStateService';
import { ProviderFactory } from '../providers/ProviderFactory';
import { WalletService } from '../WalletService';
import { IdentityRegistryService, type ShogunIdentityRecord } from '../identity/IdentityRegistryService';
import { SecurityPolicyEngine } from '../SecurityPolicyEngine';
import { SigningAuthorizationService } from '../crypto/SigningAuthorizationService';
import { TransactionSigningService } from '../crypto/TransactionSigningService';
import { BroadcastAuthorizationService } from '../crypto/BroadcastAuthorizationService';
import { BroadcastService } from '../transactions/BroadcastService';
import { ActivityService } from '../transactions/ActivityService';
import type { SignedPayload } from '../crypto/types';

export type EvmRotationStatus =
  | 'ROTATED_EMPTY'
  | 'ROTATED_SWEPT'
  | 'PENDING'
  | 'BLOCKED'
  | 'FAILED';

export type EvmRotationResult = {
  status: EvmRotationStatus;
  reason: string;
  oldAddress: string;
  newAddress?: string;
  transactionHash?: string;
};

const EVM_GAS_LIMIT = 21000n;
const ACCOUNT_ID = 'primary';

function nextEvmIndex(identities: ShogunIdentityRecord[]): number {
  if (identities.length === 0) return 1;
  return Math.max(...identities.map((identity) => identity.index)) + 1;
}

/**
 * User-triggered address rotation for EVM/ETH.
 *
 * Replaces the old automatic "Protect Before Send" migration that ran
 * silently inside the send flow. Rotation is now an explicit action the
 * user takes after receiving funds and again after sending. It always
 * sweeps the full balance (minus this transaction's own gas) to a brand
 * new address and permanently retires the old one.
 */
export class EvmAddressRotationService {
  static async rotate(
    sourceAddress: string,
    network: string = 'ETH',
    securityProfile: SecurityProfile = 'PROTECTED',
    accountId: string = ACCOUNT_ID
  ): Promise<EvmRotationResult> {
    const normalizedSource = sourceAddress.trim();

    if (!ethers.isAddress(normalizedSource)) {
      return {
        status: 'BLOCKED',
        reason: 'A valid EVM source address is required.',
        oldAddress: normalizedSource,
      };
    }

    const identities = await IdentityRegistryService.list(accountId, 'EVM');
    const sourceIdentity =
      identities.find(
        (identity) =>
          identity.address.toLowerCase() === normalizedSource.toLowerCase() &&
          identity.lifecycle === 'ACTIVE'
      ) ?? null;

    if (!sourceIdentity) {
      return {
        status: 'BLOCKED',
        reason: 'The source address must be an active, registered identity before it can be rotated.',
        oldAddress: normalizedSource,
      };
    }

    const provider = ProviderFactory.getProvider('ETH');
    const balance = await provider.getBalance(normalizedSource);
    const balanceBaseUnits = ethers.parseEther(balance.confirmed || '0');

    const targetIndex = nextEvmIndex(identities);
    const spendAddress = await WalletService.getEthereumWallet(targetIndex);

    if (balanceBaseUnits <= 0n) {
      const reserved = await IdentityRegistryService.reserve({
        accountId,
        chain: 'EVM',
        purpose: 'SPEND',
        index: targetIndex,
        address: spendAddress.address,
      });

      await IdentityRegistryService.activate(reserved.identityId);
      await IdentityRegistryService.retire(sourceIdentity.identityId);

      await ActivityService.addActivity(
        'SECURITY',
        'Address Rotated',
        `${normalizedSource} retired. New address ${reserved.address} is now active (nothing to sweep).`
      );

      return {
        status: 'ROTATED_EMPTY',
        reason: 'No balance to sweep. New address is active and the old address is retired.',
        oldAddress: normalizedSource,
        newAddress: reserved.address,
      };
    }

    const networkState = await NetworkStateService.resolve({
      chain: 'EVM',
      network,
      from: normalizedSource,
      to: normalizedSource,
    });

    if (networkState.status !== 'READY' || !networkState.gasPriceBaseUnits) {
      return {
        status: 'BLOCKED',
        reason: `Network state is not ready for rotation: ${networkState.warnings.join('; ')}`,
        oldAddress: normalizedSource,
      };
    }

    const gasPriceBaseUnits = BigInt(networkState.gasPriceBaseUnits);
    const migrationFee = EVM_GAS_LIMIT * gasPriceBaseUnits;

    if (balanceBaseUnits <= migrationFee) {
      return {
        status: 'BLOCKED',
        reason: 'The balance is too small to cover the network fee required to sweep it.',
        oldAddress: normalizedSource,
      };
    }

    const sweepAmount = balanceBaseUnits - migrationFee;

    const reserved = await IdentityRegistryService.reserve({
      accountId,
      chain: 'EVM',
      purpose: 'SPEND',
      index: targetIndex,
      address: spendAddress.address,
    });

    const intent: TransactionIntent = {
      intentId: createTransactionIntentId(),
      accountId,
      asset: { symbol: 'ETH', chain: 'EVM', network, chainId: networkState.chainId },
      from: normalizedSource,
      to: reserved.address,
      amount: ethers.formatEther(sweepAmount),
      amountUnit: 'NATIVE',
      sendMode: 'SPEND_TOTAL',
      securityProfile,
      createdAt: Date.now(),
      metadata: {
        operation: 'ADDRESS_ROTATION_SWEEP',
        sourceIdentityId: sourceIdentity.identityId,
        targetIdentityId: reserved.identityId,
      },
    };

    let construction: Awaited<ReturnType<typeof TransactionConstructionService.prepare>>;

    try {
      construction = await TransactionConstructionService.prepare(intent);
    } catch (error) {
      await IdentityRegistryService.transition(reserved.identityId, 'FAILED');
      return {
        status: 'FAILED',
        reason: error instanceof Error ? error.message : 'Rotation sweep construction failed.',
        oldAddress: normalizedSource,
      };
    }

    const providerStatus = await provider.getStatus();
    const policy = SecurityPolicyEngine.evaluate(intent, null, {
      broadcastSupported: true,
      providerConnected: providerStatus.connected,
      providerMode: providerStatus.mode,
    });

    if (policy.decision === 'BLOCK' || policy.requiresRotation || policy.requiresMigration) {
      await IdentityRegistryService.transition(reserved.identityId, 'FAILED');
      return {
        status: 'BLOCKED',
        reason: `Rotation sweep blocked by security policy: ${policy.reasonCodes.join(' • ')}`,
        oldAddress: normalizedSource,
      };
    }

    const signingAuthorization = await SigningAuthorizationService.authorize(
      intent,
      policy,
      construction.transactionDigest
    );

    if (!signingAuthorization.authorized) {
      await IdentityRegistryService.transition(reserved.identityId, 'FAILED');
      return {
        status: 'BLOCKED',
        reason: signingAuthorization.reason,
        oldAddress: normalizedSource,
      };
    }

    let signed: SignedPayload;

    try {
      signed = await TransactionSigningService.sign({
        intent,
        construction,
        authorization: signingAuthorization.authorization,
        derivationRef: { index: sourceIdentity.index },
      });
    } catch (error) {
      await IdentityRegistryService.transition(reserved.identityId, 'FAILED');
      return {
        status: 'FAILED',
        reason: error instanceof Error ? error.message : 'Rotation sweep signing failed.',
        oldAddress: normalizedSource,
      };
    }

    const broadcastAuthorization = await BroadcastAuthorizationService.authorize(intent, signed);

    if (!broadcastAuthorization.authorized) {
      await IdentityRegistryService.transition(reserved.identityId, 'FAILED');
      return {
        status: 'BLOCKED',
        reason: broadcastAuthorization.reason,
        oldAddress: normalizedSource,
      };
    }

    try {
      const result = await BroadcastService.broadcast(intent, signed, broadcastAuthorization.authorization);

      if (result.reconciliation.status === 'CONFIRMED') {
        await IdentityRegistryService.activate(reserved.identityId);
        await IdentityRegistryService.retire(sourceIdentity.identityId);

        await ActivityService.addActivity(
          'SECURITY',
          'Address Rotated',
          `Swept ${normalizedSource} to ${reserved.address} (${result.transactionHash}). Old address retired.`
        );

        return {
          status: 'ROTATED_SWEPT',
          reason: 'Balance swept and confirmed. New address is active and the old address is retired.',
          oldAddress: normalizedSource,
          newAddress: reserved.address,
          transactionHash: result.transactionHash,
        };
      }

      if (result.reconciliation.status === 'PENDING') {
        await ActivityService.addActivity(
          'SECURITY',
          'Address Rotation Pending',
          `Sweep ${result.transactionHash} accepted but not yet confirmed. Old address remains active until confirmed.`
        );

        return {
          status: 'PENDING',
          reason: 'Sweep broadcast was accepted but is not yet confirmed. Check back shortly before using the new address.',
          oldAddress: normalizedSource,
          newAddress: reserved.address,
          transactionHash: result.transactionHash,
        };
      }

      if (result.reconciliation.status === 'UNKNOWN') {
        // UNKNOWN means the provider could not locate the transaction yet,
        // not that it failed. Treating it as FAILED here would wrongly
        // retire/fail the reserved identity for a sweep that may still land.
        await ActivityService.addActivity(
          'SECURITY',
          'Address Rotation Status Unknown',
          `Sweep ${result.transactionHash} accepted but could not be located by the provider yet. Old address remains active; reconciliation should be retried.`
        );

        return {
          status: 'PENDING',
          reason: 'Sweep broadcast was accepted but the provider could not yet locate the transaction. Retry reconciliation before taking further action.',
          oldAddress: normalizedSource,
          newAddress: reserved.address,
          transactionHash: result.transactionHash,
        };
      }

      await IdentityRegistryService.transition(reserved.identityId, 'FAILED');
      return {
        status: 'FAILED',
        reason: 'Sweep transaction was mined with a failed execution status.',
        oldAddress: normalizedSource,
        transactionHash: result.transactionHash,
      };
    } catch (error) {
      await ActivityService.addActivity(
        'SEND_BLOCKED',
        'Address Rotation Failed',
        error instanceof Error ? error.message : 'Rotation sweep broadcast failed.'
      );

      return {
        status: 'FAILED',
        reason: error instanceof Error ? error.message : 'Rotation sweep broadcast failed.',
        oldAddress: normalizedSource,
      };
    }
  }
}
