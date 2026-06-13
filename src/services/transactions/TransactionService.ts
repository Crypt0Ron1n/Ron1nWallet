import { ProviderFactory } from '../providers/ProviderFactory';
import { Ron1nTransaction } from './types';

export type TransactionHistoryRequest = {
  symbol: string;
  address: string;
};

export class TransactionService {
  static async getTransactions(
    symbol: string,
    address: string
  ): Promise<Ron1nTransaction[]> {
    const provider = ProviderFactory.getProvider(symbol);
    return provider.getTransactions(address);
  }

  static async getTransactionHistory(requests: TransactionHistoryRequest[]) {
    const results = await Promise.all(
      requests.map(async (request) => {
        const transactions = await this.getTransactions(request.symbol, request.address);
        return [request.symbol, transactions] as const;
      })
    );

    return Object.fromEntries(results) as Record<string, Ron1nTransaction[]>;
  }
}