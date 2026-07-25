import { ProviderFactory } from '../providers/ProviderFactory';
import { Ron1nBalance } from './types';

export type BalanceRequest = {
  symbol: string;
  address: string;
};

export type BalanceSyncStatus = 'OK' | 'FAILED' | 'EMPTY_ADDRESS';

export type BalanceSyncResult = {
  symbol: string;
  address: string;
  status: BalanceSyncStatus;
  balance: Ron1nBalance | null;
  error?: string;
};

const PROVIDER_TIMEOUT_MS = 12000;

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

export class BalanceService {
  static async getBalance(symbol: string, address: string): Promise<Ron1nBalance> {
    const provider = ProviderFactory.getProvider(symbol);

    return withTimeout(
      provider.getBalance(address),
      PROVIDER_TIMEOUT_MS,
      `${symbol} balance provider`
    );
  }

  static async getBalanceSafe(request: BalanceRequest): Promise<BalanceSyncResult> {
    const symbol = request.symbol.toUpperCase();
    const address = request.address?.trim();

    if (!address) {
      return {
        symbol,
        address: '',
        status: 'EMPTY_ADDRESS',
        balance: null,
        error: 'Missing address',
      };
    }

    try {
      const balance = await this.getBalance(symbol, address);

      return {
        symbol,
        address,
        status: 'OK',
        balance,
      };
    } catch (error: any) {
      console.warn(`${symbol} balance sync failed:`, error);

      return {
        symbol,
        address,
        status: 'FAILED',
        balance: null,
        error: error?.message || 'Balance sync failed',
      };
    }
  }

  static async getBalancesDetailed(
    requests: BalanceRequest[]
  ): Promise<Record<string, BalanceSyncResult>> {
    const results = await Promise.all(
      requests.map((request) => this.getBalanceSafe(request))
    );

    return Object.fromEntries(
      results.map((result) => [result.symbol, result])
    ) as Record<string, BalanceSyncResult>;
  }

  static async getBalances(requests: BalanceRequest[]) {
    const detailed = await this.getBalancesDetailed(requests);

    const balances = Object.entries(detailed)
      .filter(([, result]) => result.status === 'OK' && result.balance)
      .map(([symbol, result]) => [symbol, result.balance as Ron1nBalance] as const);

    return Object.fromEntries(balances) as Record<string, Ron1nBalance>;
  }
}