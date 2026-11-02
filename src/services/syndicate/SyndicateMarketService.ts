import { PriceService } from '../PriceService';
import { RON1N_ASSETS, resolveNetworkIdentifier } from '../../config/assetCatalog';
import { pointsToCandles, type Candle } from '../../utils/candlestickMath';

type FineGrainedPoints = Record<string, Array<{ t: number; price: number }>>;

/**
 * 5m/15m/24h all resample the SAME real 1-day point series - only the
 * bucket width differs. Without this cache, switching between those three
 * timeframes re-fetched that series from scratch every tap (12-16 parallel
 * per-coin requests each time), which was enough to exhaust the CoinGecko
 * free-tier rate limit within a few taps and leave every timeframe showing
 * no data. A short TTL is safe since the source data is itself only
 * 5-minute-resolution.
 */
let cachedPointSeries: { data: FineGrainedPoints; fetchedAt: number } | null = null;
const POINT_SERIES_TTL_MS = 60 * 1000;

export type SyndicateCandleTimeframe = '5m' | '15m' | '4h' | '24h';

const TIMEFRAME_BUCKET_MS: Record<'5m' | '15m' | '24h', number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  // Real hourly candles over the same 1-day point series used for 5m/15m -
  // ~24 bars, no extra API call.
  '24h': 60 * 60 * 1000,
};

/**
 * Both the 5m/15m resample (up to ~288 raw points) and the 4h OHLC window
 * are trimmed to this many most-recent candles. Without this, 5m/15m would
 * try to cram 96-288 candles into a card-sized chart - every value still
 * real, just visually illegible. Keeping only the most recent window keeps
 * the chart readable while staying honest about what it's showing (recent
 * history, not the full 7/1-day range).
 */
const MAX_CANDLES = 48;

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

  /**
   * Real candles for every catalog asset, keyed by symbol, for the
   * Syndicate market view's candlestick toggle. Deliberately separate from
   * `loadLive()`/`buildRows()` and fetched lazily - only when the user
   * switches to candle view (and again per timeframe the first time it's
   * selected) - never on every price refresh. A symbol absent from the
   * result means no real data was available for that timeframe; callers
   * must render that as "no chart data", never a synthesized candle.
   *
   * '4h' uses CoinGecko's native OHLC endpoint (7-day window, which
   * CoinGecko itself buckets into 4-hour candles). '5m' and '15m' have no
   * selectable-interval OHLC endpoint on the free tier, so they are
   * genuinely derived (via candlestickMath.pointsToCandles) from a real,
   * confirmed 5-minute point-sampled price series - not fabricated, see
   * PriceService.getFineGrainedPrices.
   */
  static async loadCandles(timeframe: SyndicateCandleTimeframe): Promise<Record<string, Candle[]>> {
    const symbols = RON1N_ASSETS.map((asset) => asset.symbol);

    if (timeframe === '4h') {
      const ohlc = await PriceService.getOhlc(symbols);
      const candles: Record<string, Candle[]> = {};
      for (const [symbol, bars] of Object.entries(ohlc)) {
        candles[symbol] = bars.slice(-MAX_CANDLES).map(({ o, h, l, c }) => ({ o, h, l, c }));
      }
      return candles;
    }

    const bucketMs = TIMEFRAME_BUCKET_MS[timeframe];

    const now = Date.now();
    if (!cachedPointSeries || now - cachedPointSeries.fetchedAt > POINT_SERIES_TTL_MS) {
      cachedPointSeries = { data: await PriceService.getFineGrainedPrices(symbols), fetchedAt: now };
    }
    const pointSeries = cachedPointSeries.data;

    const candles: Record<string, Candle[]> = {};
    for (const [symbol, points] of Object.entries(pointSeries)) {
      const resampled = pointsToCandles(points, bucketMs).slice(-MAX_CANDLES);
      if (resampled.length > 0) {
        candles[symbol] = resampled;
      }
    }

    return candles;
  }
}
