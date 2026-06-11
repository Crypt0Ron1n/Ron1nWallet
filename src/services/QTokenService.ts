import AsyncStorage from '@react-native-async-storage/async-storage';

export type QAssetRecord = {
  symbol: string;
  qSymbol: string;
  enabled: boolean;
  enabledAt?: string;
};

const KEY = 'ron1n_qassets_v1';

export class QTokenService {
  static async enableQAsset(symbol: string) {
    const all = await this.getAll();

    const record: QAssetRecord = {
      symbol,
      qSymbol: `q${symbol}`,
      enabled: true,
      enabledAt: new Date().toISOString(),
    };

    const next = all.filter((item) => item.symbol !== symbol);
    next.push(record);

    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return record;
  }

  static async getQAsset(symbol: string) {
    const all = await this.getAll();
    return all.find((item) => item.symbol === symbol) ?? null;
  }

  static async getAll(): Promise<QAssetRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}