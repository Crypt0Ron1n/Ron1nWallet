import type { SupportedChain } from '../crypto/types';
import type { TransactionIntent } from '../transactions/TransactionIntent';
import type { NetworkState } from '../network/types';

export type ChainAdapterId = SupportedChain;
export type TransactionDraftKind = 'EVM_TRANSFER'|'EVM_ERC20_TRANSFER'|'UTXO_TRANSFER'|'SOLANA_TRANSFER'|'XRP_PAYMENT'|'STELLAR_PAYMENT'|'ALGORAND_PAYMENT';

export type UnsignedTransactionDraft = {
  draftVersion: '1.1.0';
  kind: TransactionDraftKind;
  chain: SupportedChain;
  asset: string;
  accountId: string;
  intentId: string;
  from: string;
  to: string;
  amount: string;
  amountUnit: 'NATIVE'|'TOKEN';
  amountBaseUnits?: string;
  network: string;
  chainId?: number;
  memo?: string;
  payload: Readonly<Record<string, unknown>>;
  signable: false;
};

export type ChainAdapterContext = { intent: TransactionIntent; networkState: NetworkState };
export type TransactionConstructionResult = { draft: UnsignedTransactionDraft; networkState: NetworkState; transactionDigest: string; warnings: readonly string[] };
export type ChainAdapter = { chain: ChainAdapterId; buildDraft(context: ChainAdapterContext): Promise<UnsignedTransactionDraft>; validateRecipient(recipient: string): boolean };
