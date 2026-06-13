import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';
import {
  AddressExposureInfo,
  ChainFamily,
  ChainProvider,
  ChainProviderStatus,
  TransactionRequest,
} from './types';

export class BaseMockProvider implements ChainProvider {
  chain: string;
  family: ChainFamily;

  constructor(chain: string, family: ChainFamily) {
    this.chain = chain;
    this.family = family;
  }

  async getStatus(): Promise<ChainProviderStatus> {
    return {
      chain: this.chain,
      family: this.family,
      connected: true,
      mode: 'MOCK',
      message: `${this.chain} provider scaffold ready. Live RPC not connected yet.`,
    };
  }

  async getBalance(address: string): Promise<Ron1nBalance> {
    return {
      symbol: this.chain,
      address,
      confirmed: '0',
      status: 'EMPTY',
      updatedAt: new Date().toISOString(),
      message: 'Mock provider balance',
    };
  }

  async getTransactions(_address: string): Promise<Ron1nTransaction[]> {
    return [];
  }

  async getAddressInfo(address: string): Promise<AddressExposureInfo> {
    return {
      address,
      chain: this.chain,
      asset: this.chain,
      txCount: 0,
      outgoingTxCount: 0,
      hasSentTransactions: false,
      publicKeyExposed: false,
    };
  }

  async estimateFee(_request: TransactionRequest): Promise<bigint> {
    return BigInt(0);
  }

  async broadcast(_signedTx: string): Promise<string> {
    throw new Error(`${this.chain} broadcast is not connected yet.`);
  }
}