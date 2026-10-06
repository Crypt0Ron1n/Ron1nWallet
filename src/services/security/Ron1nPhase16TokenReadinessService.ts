import { RON1N_ASSETS } from '../../config/assetCatalog';

export type TokenReadiness = {
  symbol: string;
  status: 'READY' | 'BLOCKED';
  reason: string;
};

const tokenSymbols = ['LINK', 'USDC', 'USDG'] as const;

/**
 * Phase 16: token execution must not be implied merely because a token is
 * listed in the UI. This registry is intentionally conservative until the
 * token-specific construction/signing/balance tests are independently passed.
 */
export class Ron1nPhase16TokenReadinessService {
  static list(): TokenReadiness[] {
    return tokenSymbols.map((symbol) => {
      const asset = RON1N_ASSETS.find(
        (candidate) => candidate.symbol.toUpperCase() === symbol
      );

      if (!asset) {
        return {
          symbol,
          status: 'BLOCKED',
          reason: 'Token is not present in the current asset catalog.',
        };
      }

      return {
        symbol,
        status: 'BLOCKED',
        reason:
          'Token UI/catalog support exists, but production token transfer, gas funding, and migration execution require independent end-to-end validation before broadcast is enabled.',
      };
    });
  }

  static isExecutionReady(symbol: string): boolean {
    return this.list().some(
      (item) => item.symbol === symbol.toUpperCase() && item.status === 'READY'
    );
  }
}