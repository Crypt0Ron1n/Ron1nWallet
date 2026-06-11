import AsyncStorage from '@react-native-async-storage/async-storage';

export type QuantumExposureStatus =
  | 'UNEXPOSED'
  | 'EXPOSED'
  | 'MIGRATION_READY'
  | 'PROTECTED'
  | 'UNKNOWN';

export type QuantumExposureRecord = {
  symbol: string;
  address: string;
  publicKeyExposed: boolean;
  hasSentTransactions: boolean;
  txCount: number;
  status: QuantumExposureStatus;
  recommendation: string;
  updatedAt: string;
};

const KEY = 'ron1n_quantum_exposure_v1';

export class QuantumExposureService {
  static async scanAsset(symbol: string, address: string): Promise<QuantumExposureRecord> {
    const existing = await this.getExposure(symbol);

    const record: QuantumExposureRecord = {
      symbol,
      address,
      publicKeyExposed: existing?.publicKeyExposed ?? false,
      hasSentTransactions: existing?.hasSentTransactions ?? false,
      txCount: existing?.txCount ?? 0,
      status: existing?.status ?? 'UNEXPOSED',
      recommendation:
        existing?.recommendation ??
        'Address has no known outgoing transactions. Public key exposure appears low.',
      updatedAt: new Date().toISOString(),
    };

    await this.saveExposure(record);
    return record;
  }

  static async markExposed(symbol: string, address: string) {
    const record: QuantumExposureRecord = {
      symbol,
      address,
      publicKeyExposed: true,
      hasSentTransactions: true,
      txCount: 1,
      status: 'EXPOSED',
      recommendation: 'Public key exposure detected. Address rotation is recommended.',
      updatedAt: new Date().toISOString(),
    };

    await this.saveExposure(record);
    return record;
  }

  static async markProtected(symbol: string, address: string) {
    const record: QuantumExposureRecord = {
      symbol,
      address,
      publicKeyExposed: false,
      hasSentTransactions: false,
      txCount: 0,
      status: 'PROTECTED',
      recommendation: 'Asset is marked as quantum-hardened inside Ron1n.',
      updatedAt: new Date().toISOString(),
    };

    await this.saveExposure(record);
    return record;
  }

  static async saveExposure(record: QuantumExposureRecord) {
    const all = await this.getAllExposure();
    const next = all.filter((item) => item.symbol !== record.symbol);
    next.push(record);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }

  static async getExposure(symbol: string) {
    const all = await this.getAllExposure();
    return all.find((item) => item.symbol === symbol) ?? null;
  }

  static async getAllExposure(): Promise<QuantumExposureRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static async clearExposure() {
    await AsyncStorage.removeItem(KEY);
  }
}