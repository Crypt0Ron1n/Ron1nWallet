import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';
import { BaseMockProvider } from './BaseMockProvider';

const RPC_URLS: Record<string, string> = {
  ETH: 'https://ethereum.publicnode.com',
  AVAX: 'https://api.avax.network/ext/bc/C/rpc',
  CRO: 'https://evm.cronos.org',
  BERA: 'https://rpc.berachain.com',
  BASE: 'https://mainnet.base.org',
  POL: 'https://polygon-rpc.com',
  ARB: 'https://arb1.arbitrum.io/rpc',
};

function formatUnits(value: bigint, decimals = 18) {
  const negative = value < BigInt(0);
  const raw = negative ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fractionText ? `.${fractionText}` : ''}`;
}

export class EvmProvider extends BaseMockProvider {
  chainId: number;
  rpcUrl?: string;

  constructor(chain: string, chainId: number, rpcUrl?: string) {
    super(chain, 'EVM');
    this.chainId = chainId;
    this.rpcUrl = rpcUrl ?? RPC_URLS[chain];
  }

  async getStatus() {
    return {
      chain: this.chain,
      family: this.family,
      connected: Boolean(this.rpcUrl),
      mode: this.rpcUrl ? ('RPC' as const) : ('MOCK' as const),
      message: this.rpcUrl
        ? `${this.chain} RPC endpoint configured.`
        : `${this.chain} RPC endpoint not configured.`,
    };
  }

  async getBalance(address: string): Promise<Ron1nBalance> {
    if (!this.rpcUrl) {
      return super.getBalance(address);
    }

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
      });

      const data = await response.json();

      if (!data.result) {
        throw new Error('Missing EVM balance result');
      }

      const wei = BigInt(data.result);
      const confirmed = formatUnits(wei, 18);

      return {
        symbol: this.chain,
        address,
        confirmed,
        status: wei > BigInt(0) ? 'ACTIVE' : 'EMPTY',
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        symbol: this.chain,
        address,
        confirmed: '0',
        status: 'ERROR',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'EVM balance fetch failed',
      };
    }
  }

  async getTransactions(_address: string): Promise<Ron1nTransaction[]> {
    return [];
  }
}