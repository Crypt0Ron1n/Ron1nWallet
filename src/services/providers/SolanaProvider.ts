import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';
import { BaseMockProvider } from './BaseMockProvider';

const SOL_RPC = 'https://api.mainnet-beta.solana.com';

function lamportsToSol(lamports: number) {
  return (lamports / 1_000_000_000).toString();
}

export class SolanaProvider extends BaseMockProvider {
  constructor() {
    super('SOL', 'SOLANA');
  }

  async getStatus() {
    return {
      chain: this.chain,
      family: this.family,
      connected: true,
      mode: 'RPC' as const,
      message: 'Solana public RPC configured.',
    };
  }

  async getBalance(address: string): Promise<Ron1nBalance> {
    try {
      const response = await fetch(SOL_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      });

      const data = await response.json();
      const lamports = data.result?.value ?? 0;

      return {
        symbol: 'SOL',
        address,
        confirmed: lamportsToSol(lamports),
        status: lamports > 0 ? 'ACTIVE' : 'EMPTY',
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        symbol: 'SOL',
        address,
        confirmed: '0',
        status: 'ERROR',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'SOL balance fetch failed',
      };
    }
  }

  async getTransactions(address: string): Promise<Ron1nTransaction[]> {
    try {
      const response = await fetch(SOL_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [address, { limit: 25 }],
        }),
      });

      const data = await response.json();
      const result = data.result;

      if (!Array.isArray(result)) return [];

      return result.map((item: any) => ({
        id: item.signature,
        chain: 'SOL',
        asset: 'SOL',
        direction: 'UNKNOWN',
        amount: '0',
        from: address,
        to: address,
        timestamp: item.blockTime
          ? new Date(item.blockTime * 1000).toISOString()
          : new Date().toISOString(),
        status: item.confirmationStatus === 'finalized' ? 'CONFIRMED' : 'PENDING',
      }));
    } catch {
      return [];
    }
  }

  async getAddressInfo(address: string) {
    const txs = await this.getTransactions(address);
    const txCount = txs.length;

    return {
      address,
      chain: 'SOL',
      asset: 'SOL',
      txCount,
      outgoingTxCount: txCount > 0 ? 1 : 0,
      hasSentTransactions: txCount > 0,
      publicKeyExposed: txCount > 0,
      lastActivityAt: txs[0]?.timestamp,
    };
  }
}