import { ChainActivityCacheService } from '../transactions/ChainActivityCacheService';
import { ExposureScannerService } from './ExposureScannerService';

export type Phase8IdentityExposureValidation = {
  status: 'PASS' | 'WARN';
  cachedAssetCount: number;
  failedProviderCount: number;
  overallExposure: string;
  checkedAt: string;
  detail: string;
};

export class Ron1nPhase8IdentityExposureValidationService {
  static async run(): Promise<Phase8IdentityExposureValidation> {
    const cache = await ChainActivityCacheService.getCache();
    const portfolio = ExposureScannerService.scanPortfolio(cache);
    const failedProviderCount = portfolio.failedAssets;
    return {
      status: failedProviderCount === 0 ? 'PASS' : 'WARN',
      cachedAssetCount: portfolio.totalAssetsScanned,
      failedProviderCount,
      overallExposure: portfolio.overallLevel,
      checkedAt: new Date().toISOString(),
      detail: failedProviderCount === 0
        ? 'Cached activity and exposure classification completed.'
        : 'Provider failure exists; exposure is not treated as fresh.'
    };
  }
}
