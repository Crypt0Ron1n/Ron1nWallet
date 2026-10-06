import type { SupportedChain } from '../crypto/types';

export type NetworkStateStatus = 'READY' | 'PARTIAL' | 'UNAVAILABLE';
export type NetworkStateUtxo = { txid: string; vout: number; valueBaseUnits: string; statusConfirmed: boolean };

export type NetworkState = {
  chain: SupportedChain;
  network: string;
  status: NetworkStateStatus;
  fetchedAt: number;
  chainId?: number;
  blockHeight?: number;
  nonce?: number;
  gasPriceBaseUnits?: string;
  latestBlockhash?: string;
  lastValidBlockHeight?: number;
  feeLamports?: string;
  feePerByteBaseUnits?: string;
  utxos?: readonly NetworkStateUtxo[];
  sequence?: number;
  ledgerIndex?: number;
  baseFeeBaseUnits?: string;
  feeBaseUnits?: string;
  minBalanceBaseUnits?: string;
  round?: number;
  firstValidRound?: number;
  lastValidRound?: number;
  genesisHash?: string;
  genesisId?: string;
  networkPassphrase?: string;
  warnings: readonly string[];
};

export type NetworkStateRequest = { chain: SupportedChain; network: string; from: string; to?: string };
