import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChainSyncStatus = {
  symbol: string;
  success: boolean;
  timestamp: string;
  error?: string;
};

export type GlobalSyncReport = {
  lastSyncedAt: string | null;
  statuses: Record<string, ChainSyncStatus>;
};

const SYNC_STATE_KEY = 'ron1n_sync_state_v1';

export class SyncStateService {
  static async getSyncReport(): Promise<GlobalSyncReport> {
    try {
      const data = await AsyncStorage.getItem(SYNC_STATE_KEY);
      if (!data) return { lastSyncedAt: null, statuses: {} };
      return JSON.parse(data);
    } catch {
      return { lastSyncedAt: null, statuses: {} };
    }
  }

  static async recordSyncResults(results: ChainSyncStatus[]): Promise<GlobalSyncReport> {
    const statuses: Record<string, ChainSyncStatus> = {};
    results.forEach((res) => {
      statuses[res.symbol] = res;
    });

    const report: GlobalSyncReport = {
      lastSyncedAt: new Date().toISOString(),
      statuses,
    };

    try {
      await AsyncStorage.setItem(SYNC_STATE_KEY, JSON.stringify(report));
    } catch (error) {
      console.error('Failed to persist sync report:', error);
    }

    return report;
  }
}