import { ProviderFactory } from './providers/ProviderFactory';
import { ChainProviderStatus } from './providers/types';

export class ProviderHealthService {
  static async getAllStatuses(): Promise<ChainProviderStatus[]> {
    const assets = ProviderFactory.getSupportedAssets();

    const statuses = await Promise.all(
      assets.map(async (asset) => {
        const provider = ProviderFactory.getProvider(asset);
        return provider.getStatus();
      })
    );

    return statuses;
  }

  static async getStatus(asset: string): Promise<ChainProviderStatus> {
    const provider = ProviderFactory.getProvider(asset);
    return provider.getStatus();
  }
}