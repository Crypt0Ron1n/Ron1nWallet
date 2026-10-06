import { ethers } from 'ethers';

import type { AssetMigrationRequest, AssetMigrationPlan, ChainMigrationAdapter } from './types';
import { NetworkStateService } from '../network/NetworkStateService';
import { ProviderFactory } from '../providers/ProviderFactory';
import { TransactionConstructionService } from '../transactions/TransactionConstructionService';
import { createTransactionIntentId, type TransactionIntent } from '../transactions/TransactionIntent';

const EVM_GAS_LIMIT = 21000n;

/**
 * Step 27 EVM adapter.
 *
 * This adapter covers native EVM asset migration only. It deliberately does
 * not claim ERC-20 support: token balances require contract-aware discovery,
 * nonce sequencing, gas funding, and token-specific serialization.
 *
 * The existing EvmProtectBeforeSendService remains the production SendScreen
 * executor. This adapter establishes the universal migration boundary without
 * replacing that proven path.
 */
export class EvmNativeMigrationAdapter implements ChainMigrationAdapter {
  readonly chain = 'EVM' as const;

  supports(request: AssetMigrationRequest): boolean {
    return (
      request.intent.asset.chain === 'EVM' &&
      request.intent.amountUnit === 'NATIVE' &&
      request.intent.asset.symbol === 'ETH'
    );
  }

  async prepare(request: AssetMigrationRequest): Promise<AssetMigrationPlan> {
    const now = new Date().toISOString();
    const { sourceIdentity, destinationIdentity, intent } = request;

    if (!this.supports(request)) {
      return {
        status: 'UNSUPPORTED',
        chain: 'EVM',
        accountId: request.accountId,
        intentId: intent.intentId,
        sourceIdentityId: sourceIdentity.identityId,
        destinationIdentityId: destinationIdentity.identityId,
        sourceAddress: sourceIdentity.address,
        destinationAddress: destinationIdentity.address,
        intent,
        reason: 'Only native ETH migration is enabled in the Step 27 EVM adapter.',
        requiresUserAuthorization: false,
        requiresBiometricAuthorization: false,
        canExecute: false,
        createdAt: now,
      };
    }

    if (!ethers.isAddress(sourceIdentity.address) || !ethers.isAddress(destinationIdentity.address)) {
      return {
        status: 'INVALID',
        chain: 'EVM',
        accountId: request.accountId,
        intentId: intent.intentId,
        sourceIdentityId: sourceIdentity.identityId,
        destinationIdentityId: destinationIdentity.identityId,
        sourceAddress: sourceIdentity.address,
        destinationAddress: destinationIdentity.address,
        intent,
        reason: 'EVM migration requires valid source and destination addresses.',
        requiresUserAuthorization: false,
        requiresBiometricAuthorization: false,
        canExecute: false,
        createdAt: now,
      };
    }

    const provider = ProviderFactory.getProvider(intent.asset.symbol);
    const status = await provider.getStatus();

    if (!status.connected || status.mode !== 'RPC') {
      return {
        status: 'BLOCKED',
        chain: 'EVM',
        accountId: request.accountId,
        intentId: intent.intentId,
        sourceIdentityId: sourceIdentity.identityId,
        destinationIdentityId: destinationIdentity.identityId,
        sourceAddress: sourceIdentity.address,
        destinationAddress: destinationIdentity.address,
        intent,
        reason: `EVM provider is not ready for migration (${status.mode}).`,
        requiresUserAuthorization: false,
        requiresBiometricAuthorization: false,
        canExecute: false,
        createdAt: now,
      };
    }

    const balance = await provider.getBalance(sourceIdentity.address);
    let balanceWei: bigint;

    try {
      balanceWei = ethers.parseEther(balance.confirmed || '0');
    } catch {
      return {
        status: 'BLOCKED',
        chain: 'EVM',
        accountId: request.accountId,
        intentId: intent.intentId,
        sourceIdentityId: sourceIdentity.identityId,
        destinationIdentityId: destinationIdentity.identityId,
        sourceAddress: sourceIdentity.address,
        destinationAddress: destinationIdentity.address,
        intent,
        reason: 'EVM provider returned an invalid native balance.',
        requiresUserAuthorization: false,
        requiresBiometricAuthorization: false,
        canExecute: false,
        createdAt: now,
      };
    }

    if (balanceWei <= 0n) {
      return {
        status: 'NO_BALANCE',
        chain: 'EVM',
        accountId: request.accountId,
        intentId: intent.intentId,
        sourceIdentityId: sourceIdentity.identityId,
        destinationIdentityId: destinationIdentity.identityId,
        sourceAddress: sourceIdentity.address,
        destinationAddress: destinationIdentity.address,
        intent,
        reason: 'The source identity has no confirmed native ETH balance.',
        requiresUserAuthorization: true,
        requiresBiometricAuthorization: true,
        canExecute: false,
        createdAt: now,
      };
    }

    const networkState = await NetworkStateService.resolve({
      chain: 'EVM',
      network: intent.asset.network,
      from: sourceIdentity.address,
      to: destinationIdentity.address,
    });

    if (networkState.status !== 'READY' || !networkState.gasPriceBaseUnits) {
      return {
        status: 'BLOCKED',
        chain: 'EVM',
        accountId: request.accountId,
        intentId: intent.intentId,
        sourceIdentityId: sourceIdentity.identityId,
        destinationIdentityId: destinationIdentity.identityId,
        sourceAddress: sourceIdentity.address,
        destinationAddress: destinationIdentity.address,
        intent,
        reason: `EVM migration network state is not ready: ${networkState.warnings.join('; ')}`,
        requiresUserAuthorization: false,
        requiresBiometricAuthorization: false,
        canExecute: false,
        createdAt: now,
      };
    }

    const gasPriceWei = BigInt(networkState.gasPriceBaseUnits);
    const feeWei = EVM_GAS_LIMIT * gasPriceWei;

    if (balanceWei <= feeWei) {
      return {
        status: 'NO_BALANCE',
        chain: 'EVM',
        accountId: request.accountId,
        intentId: intent.intentId,
        sourceIdentityId: sourceIdentity.identityId,
        destinationIdentityId: destinationIdentity.identityId,
        sourceAddress: sourceIdentity.address,
        destinationAddress: destinationIdentity.address,
        intent,
        reason: 'The source balance is insufficient to fund the migration gas fee.',
        requiresUserAuthorization: true,
        requiresBiometricAuthorization: true,
        canExecute: false,
        createdAt: now,
        metadata: {
          balanceBaseUnits: balanceWei.toString(),
          feeBaseUnits: feeWei.toString(),
        },
      };
    }

    const migrationAmount = balanceWei - feeWei;

    const migrationIntent: TransactionIntent = {
      intentId: createTransactionIntentId(),
      accountId: request.accountId,
      asset: {
        symbol: 'ETH',
        chain: 'EVM',
        network: intent.asset.network,
        ...(networkState.chainId !== undefined
          ? { chainId: networkState.chainId }
          : {}),
        ...(intent.asset.decimals !== undefined
          ? { decimals: intent.asset.decimals }
          : { decimals: 18 }),
      },
      from: sourceIdentity.address,
      to: destinationIdentity.address,
      amount: ethers.formatEther(migrationAmount),
      amountUnit: 'NATIVE',
      sendMode: 'SPEND_TOTAL',
      securityProfile: intent.securityProfile,
      createdAt: Date.now(),
      metadata: {
        ...(intent.metadata ?? {}),
        operation: 'PROTECT_BEFORE_SEND_MIGRATION',
        migrationBoundary: 'STEP_27_EVM_NATIVE_ADAPTER',
        sourceIdentityId: sourceIdentity.identityId,
        targetIdentityId: destinationIdentity.identityId,
      },
    };

    const construction = await TransactionConstructionService.prepare(migrationIntent);

    return {
      status: 'READY',
      chain: 'EVM',
      accountId: request.accountId,
      intentId: intent.intentId,
      sourceIdentityId: sourceIdentity.identityId,
      destinationIdentityId: destinationIdentity.identityId,
      sourceAddress: sourceIdentity.address,
      destinationAddress: destinationIdentity.address,
      intent: migrationIntent,
      reason: 'Native ETH migration is prepared through the universal migration boundary.',
      requiresUserAuthorization: true,
      requiresBiometricAuthorization: true,
      canExecute: true,
      createdAt: now,
      construction,
      metadata: {
        balanceBaseUnits: balanceWei.toString(),
        feeBaseUnits: feeWei.toString(),
        migrationAmountBaseUnits: migrationAmount.toString(),
        migrationIntentId: migrationIntent.intentId,
      },
    };
  }
}
