import { BaseMockProvider } from './BaseMockProvider';

export class EvmProvider extends BaseMockProvider {
  chainId: number;
  rpcUrl?: string;

  constructor(chain: string, chainId: number, rpcUrl?: string) {
    super(chain, 'EVM');
    this.chainId = chainId;
    this.rpcUrl = rpcUrl;
  }
}