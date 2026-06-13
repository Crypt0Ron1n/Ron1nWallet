import {
  AddressExposureInfo,
  ChainFamily,
  ChainProvider,
  ChainProviderStatus,
  Ron1nTransaction,
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
      message: `${this.chain} provider scaffold ready. RPC not connected yet.`,
    };
  }

  async getBalance(_address: string): Promise<bigint> {
    return BigInt(0);
  }

  async getTransactions(address: string): Promise<Ron1nTransaction[]> {
    return [
      {
        id: `${this.chain}-${Date.now()}`,
        chain: this.chain,
        asset: this.chain,
        direction: 'UNKNOWN',
        amount: '0',
        from: address,
        to: address,
        timestamp: new Date().toISOString(),
        status: 'UNKNOWN',
        fee: '0',
      },
    ];
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
      lastActivityAt: undefined,
    };
  }

  async estimateFee(_request: TransactionRequest): Promise<bigint> {
    return BigInt(0);
  }

  async broadcast(_signedTx: string): Promise<string> {
    throw new Error(`${this.chain} broadcast is not connected yet.`);
  }
}