import { RON1N_ASSETS, resolveNetworkIdentifier } from '../../config/assetCatalog';
import { SyndicateMarketService } from './SyndicateMarketService';

export type SyndicateMarketServiceSelfTestResult = {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

/**
 * Tests the market dashboard's pure assembly logic (buildRows) with
 * synthetic price inputs. No network, no vault, no wallet dependency -
 * Syndicate market data must never require either.
 */
export class SyndicateMarketServiceSelfTestService {
  static run(): SyndicateMarketServiceSelfTestResult {
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

    const prices: Record<
      string,
      { usd: number; usd24hChange: number | null; sparkline: number[] | null }
    > = {
      BTC: { usd: 85463, usd24hChange: -0.51, sparkline: [84000, 84900, 85200, 85463] },
      LINK: { usd: 13.94, usd24hChange: 0.43, sparkline: [13.5, 13.7, 13.94] },
      USDC: { usd: 0.999915, usd24hChange: -0.004, sparkline: [1.0001, 0.9999, 0.999915] },
      USDG: { usd: 0.999919, usd24hChange: -0.0001, sparkline: null }, // provider returned no sparkline for this asset
      POL: { usd: 0.126156, usd24hChange: null, sparkline: [0.1255, 0.126156] }, // provider can legitimately omit 24h change
      // Deliberately no entry for ETH, simulating a failed/unmapped lookup.
    };

    const rows = SyndicateMarketService.buildRows(prices);

    checks.push({
      name: 'ONE_ROW_PER_CATALOG_ASSET',
      passed: rows.length === RON1N_ASSETS.length,
      detail: `Every asset in RON1N_ASSETS must get a market row, including Token-family assets. Expected ${RON1N_ASSETS.length}, got ${rows.length}.`,
    });

    const tokenRows = rows.filter(
      (row) => RON1N_ASSETS.find((a) => a.symbol === row.symbol)?.category === 'Token'
    );
    checks.push({
      name: 'TOKEN_PRICES_NOT_GATED_BY_BALANCE_SUPPORT',
      passed: tokenRows.length === 3 && tokenRows.every((row) => row.status === 'LIVE'),
      detail: 'LINK/USDC/USDG must show a live market price even though their wallet balance is not implemented - price and balance are independent capabilities.',
    });

    const btcRow = rows.find((row) => row.symbol === 'BTC');
    checks.push({
      name: 'LIVE_PRICE_AND_CHANGE_PASSED_THROUGH_EXACTLY',
      passed: btcRow?.status === 'LIVE' && btcRow?.priceUsd === 85463 && btcRow?.change24h === -0.51,
      detail: `Expected BTC priceUsd=85463, change24h=-0.51, got priceUsd=${btcRow?.priceUsd}, change24h=${btcRow?.change24h}.`,
    });

    const ethRow = rows.find((row) => row.symbol === 'ETH');
    checks.push({
      name: 'MISSING_PRICE_NEVER_FABRICATES_ZERO',
      passed: ethRow?.status === 'NO_PRICE_DATA' && ethRow?.priceUsd === null && ethRow?.change24h === null,
      detail: `A symbol absent from the price fetch must render as NO_PRICE_DATA with priceUsd=null, never $0. Got status=${ethRow?.status}, priceUsd=${ethRow?.priceUsd}.`,
    });

    const polRow = rows.find((row) => row.symbol === 'POL');
    checks.push({
      name: 'MISSING_24H_CHANGE_DOES_NOT_FAIL_THE_PRICE',
      passed: polRow?.status === 'LIVE' && polRow?.priceUsd === 0.126156 && polRow?.change24h === null,
      detail: 'A real price with no 24h-change field from the provider must still show as LIVE with a null change, not be discarded.',
    });

    checks.push({
      name: 'NETWORK_IDENTIFIER_MATCHES_RESOLVER',
      passed: rows.every((row) => {
        const asset = RON1N_ASSETS.find((a) => a.symbol === row.symbol);
        return asset !== undefined && row.network === resolveNetworkIdentifier(asset);
      }),
      detail: 'Every row\'s `network` field must come from the single shared resolveNetworkIdentifier().',
    });

    const rowKeys = new Set(rows.flatMap((row) => Object.keys(row)));
    const forbiddenKeys = ['address', 'balance', 'balanceStatus', 'fiatValueUsd', 'mnemonic', 'privateKey', 'seed'];
    checks.push({
      name: 'NO_WALLET_OR_SECRET_FIELDS_ON_MARKET_ROWS',
      passed: forbiddenKeys.every((key) => !rowKeys.has(key)),
      detail: 'Syndicate market rows must never contain wallet balance/address fields or secret material - only symbol/name/network/price/change/sparkline/status.',
    });

    checks.push({
      name: 'REAL_SPARKLINE_PASSED_THROUGH_EXACTLY',
      passed: Array.isArray(btcRow?.sparkline) && btcRow!.sparkline!.join(',') === '84000,84900,85200,85463',
      detail: `BTC's sparkline must pass through unmodified - no points added/removed/reordered. Got ${JSON.stringify(btcRow?.sparkline)}.`,
    });

    const usdgRow = rows.find((row) => row.symbol === 'USDG');
    checks.push({
      name: 'LIVE_PRICE_WITH_NO_SPARKLINE_STILL_SHOWS_PRICE',
      passed: usdgRow?.status === 'LIVE' && usdgRow?.priceUsd === 0.999919 && usdgRow?.sparkline === null,
      detail: 'A real price with no provider sparkline must still render LIVE with sparkline:null, never a fabricated chart.',
    });

    checks.push({
      name: 'MISSING_PRICE_NEVER_FABRICATES_SPARKLINE',
      passed: ethRow?.sparkline === null,
      detail: `An asset with no price data must also have sparkline:null, never a fabricated series. Got ${JSON.stringify(ethRow?.sparkline)}.`,
    });

    return {
      passed: checks.every((check) => check.passed),
      checks,
    };
  }
}
