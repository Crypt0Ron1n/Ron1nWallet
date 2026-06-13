import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';
import { BaseMockProvider } from './BaseMockProvider';

function satsToCoin(sats: number) {
  return (sats / 100_000_000).toString();
}

export class UtxoProvider extends BaseMockProvider {
  constructor(chain: string) {
    super(chain, 'UTXO');
  }

  private endpoint(address: string) {
    if (this.chain === 'BTC') {
      return `https://blockstream.info/api/address/${address}`;
    }

    if (this.chain === 'LTC') {
      return `https://litecoinspace.org/api/address/${address}`;
    }

    return null;
  }

  async getBalance(address: string): Promise<Ron1nBalance> {
    const url = this.endpoint(address);

    if (!url) {
      return super.getBalance(address);
    }

    try {
      const response = await fetch(url);
      const data = await response.json();

      const funded =
        (data.chain_stats?.funded_txo_sum ?? 0) + (data.mempool_stats?.funded_txo_sum ?? 0);
      const spent =
        (data.chain_stats?.spent_txo_sum ?? 0) + (data.mempool_stats?.spent_txo_sum ?? 0);

      const balanceSats = funded - spent;

      return {
        symbol: this.chain,
        address,
        confirmed: satsToCoin(balanceSats),
        status: balanceSats > 0 ? 'ACTIVE' : 'EMPTY',
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        symbol: this.chain,
        address,
        confirmed: '0',
        status: 'ERROR',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : `${this.chain} balance fetch failed`,
      };
    }
  }

  async getTransactions(address: string): Promise<Ron1nTransaction[]> {
    const url = this.endpoint(address);

    if (!url) return [];

    try {
      const response = await fetch(`${url}/txs`);
      const data = await response.json();

      if (!Array.isArray(data)) return [];

      return data.slice(0, 25).map((tx: any) => {
        const inputContainsAddress = tx.vin?.some((input: any) =>
          input.prevout?.scriptpubkey_address === address
        );

        const outputToAddress = tx.vout?.some((output: any) =>
          output.scriptpubkey_address === address
        );

        return {
          id: tx.txid,
          chain: this.chain,
          asset: this.chain,
          direction: inputContainsAddress ? 'OUT' : outputToAddress ? 'IN' : 'UNKNOWN',
          amount: '0',
          from: inputContainsAddress ? address : 'unknown',
          to: outputToAddress ? address : 'unknown',
          timestamp: tx.status?.block_time
            ? new Date(tx.status.block_time * 1000).toISOString()
            : new Date().toISOString(),
          status: tx.status?.confirmed ? 'CONFIRMED' : 'PENDING',
          fee: tx.fee ? satsToCoin(tx.fee) : undefined,
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
      chain: this.chain,
      asset: this.chain,
      txCount: txs.length,
      outgoingTxCount,
      hasSentTransactions: outgoingTxCount > 0,
      publicKeyExposed: outgoingTxCount > 0,
      lastActivityAt: txs[0]?.timestamp,
    };
  }
}