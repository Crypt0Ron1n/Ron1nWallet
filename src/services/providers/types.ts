export type ChainFamily =
  | 'EVM'
  | 'UTXO'
  | 'SOLANA'
  | 'XRP'
  | 'STELLAR'
  | 'ALGORAND'
  | 'UNKNOWN';

export type TransactionDirection = 'IN' | 'OUT' | 'SELF' | 'UNKNOWN';

export type TransactionStatus = 'CONFIRMED' | 'PENDING' | 'FAILED' | 'UNKNOWN';

export type Ron1nTransaction = {
  id: string;
  chain: string;
  asset: string;
  direction: TransactionDirection;
  amount: string;
  from: string;
  to: string;
  timestamp: string;
  status: TransactionStatus;
  fee?: string;
};

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

  getBalance(address: string): Promise<bigint>;

  getTransactions(address: string): Promise<Ron1nTransaction[]>;

  getAddressInfo(address: string): Promise<AddressExposureInfo>;

  estimateFee(request: TransactionRequest): Promise<bigint>;

  broadcast(signedTx: string): Promise<string>;
}