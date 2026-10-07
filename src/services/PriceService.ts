const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  LTC: 'litecoin',
  ETH: 'ethereum',
  ARB: 'ethereum', // Arbitrum's native gas token is ETH
  BASE: 'ethereum', // Base's native gas token is ETH
  SOL: 'solana',
  XRP: 'ripple',
  XLM: 'stellar',
  ALGO: 'algorand',
  AVAX: 'avalanche-2',
  CRO: 'crypto-com-chain',
  POL: 'matic-network',
  BERA: 'berachain-bera',
  // Verified against https://api.coingecko.com/api/v3/search - token market
  // price is independent of whether this wallet can read the token's
  // on-chain balance (it currently cannot for LINK/USDC/USDG).
  LINK: 'chainlink',
  USDC: 'usd-coin',
  USDG: 'global-dollar', // Paxos "Global Dollar", ticker USDG
};

/**
 * Best-effort USD pricing for the portfolio total shown on the Wallet screen.
 * Never throws - an unreachable price API should degrade to "unpriced",
 * not break the wallet balance display.
 */
export class PriceService {
  static async getUsdPrices(symbols: string[]): Promise<Record<string, number>> {
    const upperSymbols = symbols.map((symbol) => symbol.toUpperCase());
    const ids = Array.from(
      new Set(
        upperSymbols
          .map((symbol) => COINGECKO_IDS[symbol])
          .filter((id): id is string => Boolean(id))
      )
    );

    if (ids.length === 0) {
      return {};
    }

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
      );

      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      const prices: Record<string, number> = {};

      for (const symbol of upperSymbols) {
        const id = COINGECKO_IDS[symbol];
        const usd = id ? data?.[id]?.usd : undefined;

        if (typeof usd === 'number') {
          prices[symbol] = usd;
        }
      }

      return prices;
    } catch {
      return {};
    }
  }

  /**
   * Live price PLUS 24h change PLUS a historical sparkline series, for
   * market-intelligence displays (Syndicate). Distinct from getUsdPrices():
   * a symbol missing from the result means a failed/unmapped lookup, never a
   * fabricated 0. Callers must render that absence as "NO PRICE DATA".
   *
   * Uses CoinGecko's /coins/markets endpoint (sparkline=true) rather than
   * /simple/price: it is the only way to fetch current price, real 24h
   * change, AND a real historical series for every requested asset in ONE
   * batched HTTP call. CoinGecko's free tier only exposes a batched
   * sparkline as `sparkline_in_7d` (hourly, 7-day) - there is no batched 24h
   * series. Fetching a true 24h series would require one
   * /coins/{id}/market_chart call PER asset, which this method deliberately
   * avoids to not hammer the API. The 24h change figure itself is still a
   * real, correct 24h value from this same response - only the sparkline
   * window is 7 days instead of 24 hours.
   */
  static async getMarketData(
    symbols: string[]
  ): Promise<
    Record<string, { usd: number; usd24hChange: number | null; sparkline: number[] | null }>
  > {
    const upperSymbols = symbols.map((symbol) => symbol.toUpperCase());
    const ids = Array.from(
      new Set(
        upperSymbols
          .map((symbol) => COINGECKO_IDS[symbol])
          .filter((id): id is string => Boolean(id))
      )
    );

    if (ids.length === 0) {
      return {};
    }

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=true&price_change_percentage=24h`
      );

      if (!response.ok) {
        return {};
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        return {};
      }

      const byId = new Map<string, any>();
      for (const entry of data) {
        if (entry && typeof entry.id === 'string') {
          byId.set(entry.id, entry);
        }
      }

      const market: Record<
        string,
        { usd: number; usd24hChange: number | null; sparkline: number[] | null }
      > = {};

      for (const symbol of upperSymbols) {
        const id = COINGECKO_IDS[symbol];
        const entry = id ? byId.get(id) : undefined;
        const usd = entry?.current_price;

        if (typeof usd === 'number') {
          const change = entry?.price_change_percentage_24h;
          const rawSparkline = entry?.sparkline_in_7d?.price;

          const sparkline =
            Array.isArray(rawSparkline) && rawSparkline.length > 0
              ? rawSparkline.filter(
                  (value: unknown): value is number =>
                    typeof value === 'number' && Number.isFinite(value)
                )
              : null;

          market[symbol] = {
            usd,
            usd24hChange: typeof change === 'number' ? change : null,
            sparkline: sparkline && sparkline.length > 0 ? sparkline : null,
          };
        }
      }

      return market;
    } catch {
      return {};
    }
  }
}
