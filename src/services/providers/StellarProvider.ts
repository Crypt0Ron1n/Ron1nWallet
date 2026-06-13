import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';
import { BaseMockProvider } from './BaseMockProvider';

const HORIZON = 'https://horizon.stellar.org';

export class StellarProvider extends BaseMockProvider {
  constructor() {
    super('XLM', 'STELLAR');
  }

  async getStatus() {
    return {
      chain: this.chain,
      family: this.family,
      connected: true,
      mode: 'RPC' as const,
      message: 'Stellar Horizon endpoint configured.',
    };
  }

  async getBalance(address: string): Promise<Ron1nBalance> {
    try {
      const response = await fetch(`${HORIZON}/accounts/${address}`);

      if (response.status === 404) {
        return {
          symbol: 'XLM',
          address,
          confirmed: '0',
          status: 'UNFUNDED',
          updatedAt: new Date().toISOString(),
          message: 'Stellar account not activated yet',
        };
      }

      const data = await response.json();
      const native = data.balances?.find((balance: any) => balance.asset_type === 'native');
      const confirmed = native?.balance ?? '0';

      return {
        symbol: 'XLM',
        address,
        confirmed,
        status: Number(confirmed) > 0 ? 'ACTIVE' : 'EMPTY',
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        symbol: 'XLM',
        address,
        confirmed: '0',
        status: 'ERROR',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'XLM balance fetch failed',
      };
    }
  }

  async getTransactions(address: string): Promise<Ron1nTransaction[]> {
    try {
      const response = await fetch(
        `${HORIZON}/accounts/${address}/payments?order=desc&limit=25`
      );

      if (response.status === 404) return [];

      const data = await response.json();
      const records = data._embedded?.records;

      if (!Array.isArray(records)) return [];

      return records.map((record: any) => ({
        id: record.id,
        chain: 'XLM',
        asset: 'XLM',
        direction: record.from === address ? 'OUT' : record.to === address ? 'IN' : 'UNKNOWN',
        amount: record.amount ?? '0',
        from: record.from ?? 'unknown',
        to: record.to ?? 'unknown',
        timestamp: record.created_at ?? new Date().toISOString(),
        status: 'CONFIRMED',
      }));
    } catch {
      return [];
    }
  }

  async getAddressInfo(address: string) {
    const txs = await this.getTransactions(address);
    const outgoingTxCount = txs.filter((tx) => tx.direction === 'OUT').length;

    return {
      address,
      chain: 'XLM',
      asset: 'XLM',
      txCount: txs.length,
      outgoingTxCount,
      hasSentTransactions: outgoingTxCount > 0,
      publicKeyExposed: outgoingTxCount > 0,
      lastActivityAt: txs[0]?.timestamp,
    };
  }
}