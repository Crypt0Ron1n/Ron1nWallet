import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';
import { BaseMockProvider } from './BaseMockProvider';

const XRP_RPC = 'https://s1.ripple.com:51234';

function dropsToXrp(drops: string | number) {
  return (Number(drops) / 1_000_000).toString();
}

export class XrpProvider extends BaseMockProvider {
  constructor() {
    super('XRP', 'XRP');
  }

  async getStatus() {
    return {
      chain: this.chain,
      family: this.family,
      connected: true,
      mode: 'RPC' as const,
      message: 'XRP Ledger public RPC configured.',
    };
  }

  async getBalance(address: string): Promise<Ron1nBalance> {
    try {
      const response = await fetch(XRP_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'account_info',
          params: [
            {
              account: address,
              ledger_index: 'validated',
            },
          ],
        }),
      });

      const data = await response.json();

      if (data.result?.error === 'actNotFound') {
        return {
          symbol: 'XRP',
          address,
          confirmed: '0',
          status: 'UNFUNDED',
          updatedAt: new Date().toISOString(),
          message: 'XRP account not activated yet',
        };
      }

      const balanceDrops = data.result?.account_data?.Balance ?? '0';

      return {
        symbol: 'XRP',
        address,
        confirmed: dropsToXrp(balanceDrops),
        status: Number(balanceDrops) > 0 ? 'ACTIVE' : 'EMPTY',
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        symbol: 'XRP',
        address,
        confirmed: '0',
        status: 'ERROR',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'XRP balance fetch failed',
      };
    }
  }

  async getTransactions(address: string): Promise<Ron1nTransaction[]> {
    try {
      const response = await fetch(XRP_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'account_tx',
          params: [
            {
              account: address,
              ledger_index_min: -1,
              ledger_index_max: -1,
              limit: 25,
            },
          ],
        }),
      });

      const data = await response.json();
      const txs = data.result?.transactions;

      if (!Array.isArray(txs)) return [];

      return txs.map((item: any) => {
        const tx = item.tx;
        const direction = tx.Account === address ? 'OUT' : tx.Destination === address ? 'IN' : 'UNKNOWN';

        return {
          id: tx.hash,
          chain: 'XRP',
          asset: 'XRP',
          direction,
          amount: tx.Amount && typeof tx.Amount === 'string' ? dropsToXrp(tx.Amount) : '0',
          from: tx.Account ?? 'unknown',
          to: tx.Destination ?? 'unknown',
          timestamp: new Date().toISOString(),
          status: item.validated ? 'CONFIRMED' : 'PENDING',
          fee: tx.Fee ? dropsToXrp(tx.Fee) : undefined,
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
      chain: 'XRP',
      asset: 'XRP',
      txCount: txs.length,
      outgoingTxCount,
      hasSentTransactions: outgoingTxCount > 0,
      publicKeyExposed: outgoingTxCount > 0,
      lastActivityAt: txs[0]?.timestamp,
    };
  }
}