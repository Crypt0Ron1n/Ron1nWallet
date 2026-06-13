import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';

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

export interface ChainProvider {
  chain: string;
  family: ChainFamily;

  getStatus(): Promise<ChainProviderStatus>;

  getBalance(address: string): Promise<Ron1nBalance>;

  getTransactions(address: string): Promise<Ron1nTransaction[]>;

  getAddressInfo(address: string): Promise<AddressExposureInfo>;

  estimateFee(request: TransactionRequest): Promise<bigint>;

  broadcast(signedTx: string): Promise<string>;
}