import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ron1nTransaction } from './types';

export type CachedChainActivity = {
  symbol: string;
  transactions: Ron1nTransaction[];
  syncedAt: string;
  status: 'OK' | 'FAILED';
  error?: string;
};

const CHAIN_ACTIVITY_CACHE_KEY = 'ron1n_chain_activity_cache_v1';

export class ChainActivityCacheService {
  static async saveCache(
    records: Record<string, CachedChainActivity>
  ): Promise<void> {
    await AsyncStorage.setItem(
      CHAIN_ACTIVITY_CACHE_KEY,
      JSON.stringify(records)
    );
  }

  static async mergeCache(
    records: Record<string, CachedChainActivity>
  ): Promise<void> {
    const current = await this.getCache();

    await this.saveCache({
      ...current,
      ...records,
    });
  }

  static async getCache(): Promise<Record<string, CachedChainActivity>> {
    try {
      const raw = await AsyncStorage.getItem(CHAIN_ACTIVITY_CACHE_KEY);

      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }

      return parsed;
    } catch (error) {
      console.warn('Failed to read chain activity cache:', error);
      return {};
    }
  }

  static async clearCache(): Promise<void> {
    await AsyncStorage.removeItem(CHAIN_ACTIVITY_CACHE_KEY);
  }
}