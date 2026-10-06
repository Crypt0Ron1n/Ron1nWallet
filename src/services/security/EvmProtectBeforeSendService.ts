import { ethers } from 'ethers';

import type { SecurityProfile } from '../transactions/TransactionIntent';
import { createTransactionIntentId, type TransactionIntent } from '../transactions/TransactionIntent';
import { TransactionConstructionService } from '../transactions/TransactionConstructionService';
import { NetworkStateService } from '../network/NetworkStateService';
import { ProviderFactory } from '../providers/ProviderFactory';
import { WalletService } from '../WalletService';
import { IdentityRegistryService, type ShogunIdentityRecord } from '../identity/IdentityRegistryService';

export type EvmProtectionPlanStatus = 'READY' | 'BLOCKED' | 'NO_BALANCE' | 'SOURCE_NOT_REGISTERED';
export type EvmProtectionPlan = {
  status: EvmProtectionPlanStatus;
  reason: string;
  sourceIdentity: ShogunIdentityRecord | null;
  spendIdentity: ShogunIdentityRecord | null;
  sourceBalanceBaseUnits?: string;
  migrationFeeBaseUnits?: string;
  finalSendFeeBaseUnits?: string;
  finalSendReserveBaseUnits?: string;
  migrationAmountBaseUnits?: string;
  intent?: TransactionIntent;
  construction?: Awaited<ReturnType<typeof TransactionConstructionService.prepare>>;
};

const EVM_GAS_LIMIT = 21000n;
const ACCOUNT_ID = 'primary';

function nextEvmIndex(identities: ShogunIdentityRecord[]): number {
  if (identities.length === 0) return 1;
  return Math.max(...identities.map((identity) => identity.index)) + 1;
}

/** Step 24 planning boundary. Reserves enough ETH for both internal migration and the requested final send. */
export class EvmProtectBeforeSendService {
  static async prepareMigration(
    accountId: string = ACCOUNT_ID,
    sourceAddress: string,
    network: string = 'ETH',
    securityProfile: SecurityProfile = 'PROTECTED',
    finalAmount?: string,
    finalSendMode: 'EXACT_SEND' | 'SPEND_TOTAL' = 'EXACT_SEND'
  ): Promise<EvmProtectionPlan> {
    const normalizedSource = sourceAddress.trim();
    if (!accountId.trim() || !ethers.isAddress(normalizedSource)) return { status:'BLOCKED', reason:'A valid account and EVM source address are required.', sourceIdentity:null, spendIdentity:null };

    const identities = await IdentityRegistryService.list(accountId, 'EVM');
    const sourceIdentity = identities.find(i => i.address.toLowerCase() === normalizedSource.toLowerCase() && i.lifecycle === 'ACTIVE') ?? null;
    if (!sourceIdentity) return { status:'SOURCE_NOT_REGISTERED', reason:'The source identity must be registered and active before an EVM migration can be prepared.', sourceIdentity:null, spendIdentity:null };
    if (sourceIdentity.purpose !== 'INGRESS') return { status:'BLOCKED', reason:'Protect Before Send migration currently accepts only active INGRESS identities.', sourceIdentity, spendIdentity:null };

    const provider = ProviderFactory.getProvider('ETH');
    const balance = await provider.getBalance(normalizedSource);
    const balanceBaseUnits = ethers.parseEther(balance.confirmed || '0');
    if (balanceBaseUnits <= 0n) return { status:'NO_BALANCE', reason:'The source EVM identity has no confirmed native ETH balance to migrate.', sourceIdentity, spendIdentity:null, sourceBalanceBaseUnits:balanceBaseUnits.toString() };

    const networkState = await NetworkStateService.resolve({ chain:'EVM', network, from:normalizedSource, to:normalizedSource });
    if (networkState.status !== 'READY' || !networkState.gasPriceBaseUnits) return { status:'BLOCKED', reason:`EVM migration network state is not ready: ${networkState.warnings.join('; ')}`, sourceIdentity, spendIdentity:null, sourceBalanceBaseUnits:balanceBaseUnits.toString() };

    const gasPriceBaseUnits = BigInt(networkState.gasPriceBaseUnits);
    const migrationFee = EVM_GAS_LIMIT * gasPriceBaseUnits;
    let finalReserve = 0n;
    let finalFee = 0n;

    if (finalAmount?.trim()) {
      let requested: bigint;
      try { requested = ethers.parseEther(finalAmount.trim()); } catch { return { status:'BLOCKED', reason:'The final ETH send amount is invalid.', sourceIdentity, spendIdentity:null }; }
      finalFee = EVM_GAS_LIMIT * gasPriceBaseUnits;
      finalReserve = finalSendMode === 'SPEND_TOTAL' ? requested : requested + finalFee;
    }

    const totalRequired = migrationFee + finalReserve;
    if (balanceBaseUnits <= totalRequired) return { status:'NO_BALANCE', reason:'The source balance is not sufficient for the Protect Before Send migration and the requested final send plus required network fees.', sourceIdentity, spendIdentity:null, sourceBalanceBaseUnits:balanceBaseUnits.toString(), migrationFeeBaseUnits:migrationFee.toString(), finalSendFeeBaseUnits:finalFee.toString(), finalSendReserveBaseUnits:finalReserve.toString() };

    const targetIndex = nextEvmIndex(identities);
    const spendAddress = await WalletService.getEthereumWallet(targetIndex);
    const reserved = await IdentityRegistryService.reserve({ accountId, chain:'EVM', purpose:'SPEND', index:targetIndex, address:spendAddress.address });
    // Sweep the entire balance except this migration transaction's own gas cost.
    // finalReserve must travel WITH the swept funds to the new spend address,
    // not be left behind in the retired INGRESS address.
    const migrationAmount = balanceBaseUnits - migrationFee;

    const migrationIntent: TransactionIntent = {
      intentId:createTransactionIntentId(), accountId,
      asset:{symbol:'ETH', chain:'EVM', network, chainId:networkState.chainId},
      from:normalizedSource, to:reserved.address, amount:ethers.formatEther(migrationAmount), amountUnit:'NATIVE',
      sendMode:'SPEND_TOTAL', securityProfile, createdAt:Date.now(),
      metadata:{ operation:'PROTECT_BEFORE_SEND_MIGRATION', sourceIdentityId:sourceIdentity.identityId, targetIdentityId:reserved.identityId },
    };

    try {
      const construction = await TransactionConstructionService.prepare(migrationIntent);
      return { status:'READY', reason:'Native ETH Protect Before Send migration is prepared for the complete internal migration + final send workflow.', sourceIdentity, spendIdentity:reserved, sourceBalanceBaseUnits:balanceBaseUnits.toString(), migrationFeeBaseUnits:migrationFee.toString(), finalSendFeeBaseUnits:finalFee.toString(), finalSendReserveBaseUnits:finalReserve.toString(), migrationAmountBaseUnits:migrationAmount.toString(), intent:migrationIntent, construction };
    } catch(error) {
      await IdentityRegistryService.transition(reserved.identityId,'FAILED');
      return { status:'BLOCKED', reason:error instanceof Error ? error.message : 'EVM migration construction failed.', sourceIdentity, spendIdentity:null, sourceBalanceBaseUnits:balanceBaseUnits.toString(), migrationFeeBaseUnits:migrationFee.toString() };
    }
  }
}
