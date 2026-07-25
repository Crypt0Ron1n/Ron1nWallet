import { ProviderFactory } from '../providers/ProviderFactory';
import { Ron1nTransaction } from './types';

export type TransactionHistoryRequest = {
  symbol: string;
  address: string;
};

export type TransactionSyncStatus = 'OK' | 'FAILED' | 'EMPTY_ADDRESS';

export type TransactionSyncResult = {
  symbol: string;
  address: string;
  status: TransactionSyncStatus;
  transactions: Ron1nTransaction[];
  error?: string;
};

const PROVIDER_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export class TransactionService {
  static async getTransactions(
    symbol: string,
    address: string
  ): Promise<Ron1nTransaction[]> {
    const provider = ProviderFactory.getProvider(symbol);

    return withTimeout(
      provider.getTransactions(address),
      PROVIDER_TIMEOUT_MS,
      `${symbol} transaction provider`
    );
  }

  static async getTransactionsSafe(
    request: TransactionHistoryRequest
  ): Promise<TransactionSyncResult> {
    const symbol = request.symbol.toUpperCase();
    const address = request.address?.trim();

    if (!address) {
      return {
        symbol,
        address: '',
        status: 'EMPTY_ADDRESS',
        transactions: [],
        error: 'Missing address',
      };
    }

    try {
      const transactions = await this.getTransactions(symbol, address);

      return {
        symbol,
        address,
        status: 'OK',
        transactions,
      };
    } catch (error: any) {
      console.warn(`${symbol} transaction sync failed:`, error);

      return {
        symbol,
        address,
        status: 'FAILED',
        transactions: [],
        error: error?.message || 'Transaction history sync failed',
      };
    }
  }

  static async getTransactionHistoryDetailed(
    requests: TransactionHistoryRequest[]
  ): Promise<Record<string, TransactionSyncResult>> {
    const results = await Promise.all(
      requests.map((request) => this.getTransactionsSafe(request))
    );

    return Object.fromEntries(
      results.map((result) => [result.symbol, result])
    ) as Record<string, TransactionSyncResult>;
  }

  static async getTransactionHistory(requests: TransactionHistoryRequest[]) {
    const detailed = await this.getTransactionHistoryDetailed(requests);

    return Object.fromEntries(
      Object.entries(detailed).map(([symbol, result]) => [
        symbol,
        result.transactions,
      ])
    ) as Record<string, Ron1nTransaction[]>;
  }
}