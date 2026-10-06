import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';
import type { SignedPayload } from '../crypto/types';

export type ChainFamily =
  | 'EVM'
  | 'UTXO'
  | 'SOLANA'
  | 'XRP'
  | 'STELLAR'
  | 'ALGORAND'
  | 'UNKNOWN';

export type AddressExposureInfo = {
  address: string;
  chain: string;
  asset: string;
  txCount: number;
  outgoingTxCount: number;
  hasSentTransactions: boolean;
  publicKeyExposed: boolean;
  lastActivityAt?: string;
};

export type TransactionRequest = {
  chain: string;
  asset: string;
  from: string;
  to: string;
  amount: string;
  memo?: string;
};

export type ChainProviderStatus = {
  chain: string;
  family: ChainFamily;
  connected: boolean;
  mode: 'MOCK' | 'RPC' | 'DISABLED';
  message: string;
};

export type BroadcastReconciliation = {
  transactionHash: string;
  /**
   * UNKNOWN means the provider could not find the transaction at all (not
   * mempool-visible, no receipt). It is distinct from FAILED, which requires
   * a receipt with an on-chain revert status. UNKNOWN must not be treated as
   * a terminal state - callers should keep reconciling, not give up.
   */
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN';
  blockNumber?: number;
  confirmations?: number;
  observedAt: string;
};

export interface ChainProvider {
  chain: string;
  family: ChainFamily;

  getStatus(): Promise<ChainProviderStatus>;
  getBalance(address: string): Promise<Ron1nBalance>;
  getTransactions(address: string): Promise<Ron1nTransaction[]>;
  getAddressInfo(address: string): Promise<AddressExposureInfo>;
  estimateFee(request: TransactionRequest): Promise<bigint>;

  /**
   * Broadcast only an already-signed payload. Providers never receive
   * private keys, mnemonics, or unsigned transaction drafts.
   */
  broadcastSignedTransaction(signed: SignedPayload): Promise<string>;

  /**
   * Reconcile an already-broadcast transaction without constructing or signing it.
   */
  reconcileBroadcast(transactionHash: string): Promise<BroadcastReconciliation>;
}
