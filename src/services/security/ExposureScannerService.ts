import { CachedChainActivity } from '../transactions/ChainActivityCacheService';

export type ExposureLevel = 'FRESH' | 'LOW' | 'ELEVATED' | 'UNKNOWN';

export type AssetExposureReport = {
  symbol: string;
  exposureLevel: ExposureLevel;
  transactionCount: number;
  lastSyncedAt?: string;
  providerStatus: 'OK' | 'FAILED' | 'UNKNOWN';
  headline: string;
  detail: string;
  recommendation: string;
};

export type PortfolioExposureReport = {
  overallLevel: ExposureLevel;
  totalAssetsScanned: number;
  activeAssets: number;
  failedAssets: number;
  reports: AssetExposureReport[];
};

function getTransactionCount(record: CachedChainActivity): number {
  return Array.isArray(record.transactions) ? record.transactions.length : 0;
}

function classifyExposure(
  status: CachedChainActivity['status'],
  transactionCount: number
): ExposureLevel {
  if (status === 'FAILED') {
    return 'UNKNOWN';
  }

  if (transactionCount === 0) {
    return 'FRESH';
  }

  if (transactionCount <= 3) {
    return 'LOW';
  }

  return 'ELEVATED';
}

function getReportCopy(
  symbol: string,
  exposureLevel: ExposureLevel,
  transactionCount: number,
  error?: string
) {
  if (exposureLevel === 'UNKNOWN') {
    return {
      headline: `${symbol} exposure unknown`,
      detail:
        error ||
        'Provider data was unavailable during the last manual sync, so exposure could not be assessed.',
      recommendation:
        'Retry manual sync later. Do not assume this address is fresh until provider data is available.',
    };
  }

  if (exposureLevel === 'FRESH') {
    return {
      headline: `${symbol} appears fresh`,
      detail:
        'No public-chain transactions were returned by the provider during the last manual sync.',
      recommendation:
        'Good for receiving. Continue avoiding unnecessary address reuse when possible.',
    };
  }

  if (exposureLevel === 'LOW') {
    return {
      headline: `${symbol} has light public exposure`,
      detail: `${transactionCount} transaction${
        transactionCount === 1 ? '' : 's'
      } were returned during the last manual sync.`,
      recommendation:
        'Usable, but consider rotating to a fresh receive address for stronger address hygiene.',
    };
  }

  return {
    headline: `${symbol} has elevated public exposure`,
    detail: `${transactionCount} transactions were returned during the last manual sync.`,
    recommendation:
      'Rotation is recommended before using this address for new sensitive receives. This does not move assets automatically.',
  };
}

export class ExposureScannerService {
  static scanAsset(record: CachedChainActivity): AssetExposureReport {
    const transactionCount = getTransactionCount(record);
    const exposureLevel = classifyExposure(record.status, transactionCount);
    const copy = getReportCopy(
      record.symbol,
      exposureLevel,
      transactionCount,
      record.error
    );

    return {
      symbol: record.symbol,
      exposureLevel,
      transactionCount,
      lastSyncedAt: record.syncedAt,
      providerStatus: record.status || 'UNKNOWN',
      headline: copy.headline,
      detail: copy.detail,
      recommendation: copy.recommendation,
    };
  }

  static scanPortfolio(
    cache: Record<string, CachedChainActivity>
  ): PortfolioExposureReport {
    const reports = Object.values(cache)
      .map((record) => this.scanAsset(record))
      .sort((a, b) => {
        const rank: Record<ExposureLevel, number> = {
          ELEVATED: 4,
          UNKNOWN: 3,
          LOW: 2,
          FRESH: 1,
        };

        return rank[b.exposureLevel] - rank[a.exposureLevel];
      });

    const failedAssets = reports.filter(
      (report) => report.providerStatus === 'FAILED'
    ).length;

    const activeAssets = reports.filter(
      (report) => report.transactionCount > 0
    ).length;

    let overallLevel: ExposureLevel = 'FRESH';

    if (reports.some((report) => report.exposureLevel === 'ELEVATED')) {
      overallLevel = 'ELEVATED';
    } else if (reports.some((report) => report.exposureLevel === 'UNKNOWN')) {
      overallLevel = 'UNKNOWN';
    } else if (reports.some((report) => report.exposureLevel === 'LOW')) {
      overallLevel = 'LOW';
    }

    return {
      overallLevel,
      totalAssetsScanned: reports.length,
      activeAssets,
      failedAssets,
      reports,
    };
  }
}