import { PriceService } from '../PriceService';
import { RON1N_ASSETS, resolveNetworkIdentifier } from '../../config/assetCatalog';

export type SyndicateMarketRow = {
  symbol: string;
  name: string;
  network: string;
  priceUsd: number | null;
  change24h: number | null;
  /**
   * Real historical closing prices (chronological, provider's native
   * resolution) when the provider returned any, otherwise null. Never
   * synthesized - a null/short series must render no chart.
   */
  sparkline: number[] | null;
  status: 'LIVE' | 'NO_PRICE_DATA';
};

export type SyndicateMarketSnapshot = {
  rows: SyndicateMarketRow[];
  refreshedAt: string;
};

/**
 * Syndicate is market intelligence only - it never reads a wallet address,
 * balance, or identity. A token's market price is independent of whether
 * this wallet can read that token's on-chain balance (it currently cannot
 * for LINK/USDC/USDG), so every catalog asset gets a price row regardless of
 * `enabledInWallet`/`category`. Personal holdings remain exclusively in
 * Shogun Wallet.
 */
export class SyndicateMarketService {
  /**
   * Pure assembly: combines an already-fetched price map into display rows.
   * Never fetches anything itself, so it is fully testable without network
   * access.
   */
  static buildRows(
    prices: Record<
      string,
      { usd: number; usd24hChange: number | null; sparkline: number[] | null }
    >
  ): SyndicateMarketRow[] {
    return RON1N_ASSETS.map((asset) => {
      const symbol = asset.symbol.toUpperCase();
      const market = prices[symbol];

      return {
        symbol,
        name: asset.name,
        network: resolveNetworkIdentifier(asset),
        priceUsd: market ? market.usd : null,
        change24h: market ? market.usd24hChange : null,
        sparkline: market?.sparkline ?? null,
        status: market ? 'LIVE' : 'NO_PRICE_DATA',
      };
    });
  }

  static async loadLive(): Promise<SyndicateMarketSnapshot> {
    const symbols = RON1N_ASSETS.map((asset) => asset.symbol);
    const prices = await PriceService.getMarketData(symbols);

    return {
      rows: this.buildRows(prices),
      refreshedAt: new Date().toISOString(),
    };
  }
}
