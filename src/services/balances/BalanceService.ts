import { ProviderFactory } from '../providers/ProviderFactory';
import { Ron1nBalance } from './types';

export type BalanceRequest = {
  symbol: string;
  address: string;
};

export class BalanceService {
  static async getBalance(symbol: string, address: string): Promise<Ron1nBalance> {
    const provider = ProviderFactory.getProvider(symbol);
    return provider.getBalance(address);
  }

  static async getBalances(requests: BalanceRequest[]) {
    const balances = await Promise.all(
      requests.map(async (request) => {
        const balance = await this.getBalance(request.symbol, request.address);
        return [request.symbol, balance] as const;
      })
    );

    return Object.fromEntries(balances) as Record<string, Ron1nBalance>;
  }
}