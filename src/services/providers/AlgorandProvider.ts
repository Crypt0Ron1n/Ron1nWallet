import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';
import { BaseMockProvider } from './BaseMockProvider';

const ALGO_INDEXER = 'https://mainnet-idx.algonode.cloud';

function microAlgoToAlgo(value: number) {
  return (value / 1_000_000).toString();
}

export class AlgorandProvider extends BaseMockProvider {
  constructor() {
    super('ALGO', 'ALGORAND');
  }

  async getStatus() {
    return {
      chain: this.chain,
      family: this.family,
      connected: true,
      mode: 'RPC' as const,
      message: 'Algorand AlgoNode indexer configured.',
    };
  }

  async getBalance(address: string): Promise<Ron1nBalance> {
    try {
      const response = await fetch(`${ALGO_INDEXER}/v2/accounts/${address}`);

      if (response.status === 404) {
        return {
          symbol: 'ALGO',
          address,
          confirmed: '0',
          status: 'EMPTY',
          updatedAt: new Date().toISOString(),
          message: 'Algorand account has no indexed activity yet',
        };
      }

      const data = await response.json();
      const microAlgos = data.account?.amount ?? 0;

      return {
        symbol: 'ALGO',
        address,
        confirmed: microAlgoToAlgo(microAlgos),
        status: microAlgos > 0 ? 'ACTIVE' : 'EMPTY',
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        symbol: 'ALGO',
        address,
        confirmed: '0',
        status: 'ERROR',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'ALGO balance fetch failed',
      };
    }
  }

  async getTransactions(address: string): Promise<Ron1nTransaction[]> {
    try {
      const response = await fetch(
        `${ALGO_INDEXER}/v2/accounts/${address}/transactions?limit=25`
      );

      const data = await response.json();
      const txs = data.transactions;

      if (!Array.isArray(txs)) return [];

      return txs.map((tx: any) => {
        const payment = tx['payment-transaction'];

        return {
          id: tx.id,
          chain: 'ALGO',
          asset: 'ALGO',
          direction: tx.sender === address ? 'OUT' : payment?.receiver === address ? 'IN' : 'UNKNOWN',
          amount: payment?.amount ? microAlgoToAlgo(payment.amount) : '0',
          from: tx.sender ?? 'unknown',
          to: payment?.receiver ?? 'unknown',
          timestamp: tx['round-time']
            ? new Date(tx['round-time'] * 1000).toISOString()
            : new Date().toISOString(),
          status: 'CONFIRMED',
          fee: tx.fee ? microAlgoToAlgo(tx.fee) : undefined,
        };
      });
    } catch {
      return [];
    }
  }

  async getAddressInfo(address: string) {
    const txs = await this.getTransactions(address);
    const outgoingTxCount = txs.filter((tx) => tx.direction === 'OUT').length;

    return {
      address,
      chain: 'ALGO',
      asset: 'ALGO',
      txCount: txs.length,
      outgoingTxCount,
      hasSentTransactions: outgoingTxCount > 0,
      publicKeyExposed: outgoingTxCount > 0,
      lastActivityAt: txs[0]?.timestamp,
    };
  }
}