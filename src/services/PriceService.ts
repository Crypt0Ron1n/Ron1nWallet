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
}
