import AsyncStorage from '@react-native-async-storage/async-storage';

export type ExposureStatus =
  | 'SAFE'
  | 'WATCHLIST'
  | 'EXPOSED'
  | 'ROTATION_RECOMMENDED'
  | 'PROTECTED'
  | 'UNKNOWN';

export type QuantumExposureRecord = {
  symbol: string;
  address: string;
  txCount: number;
  hasSentTransactions: boolean;
  publicKeyExposed: boolean;
  status: ExposureStatus;
  recommendation: string;
  updatedAt: string;
};

const KEY = 'ron1n_quantum_exposure_v2';

function classify(txCount: number, hasSentTransactions: boolean): ExposureStatus {
  if (!hasSentTransactions && txCount === 0) return 'SAFE';
  if (hasSentTransactions && txCount <= 5) return 'WATCHLIST';
  if (hasSentTransactions && txCount > 5 && txCount <= 20) return 'EXPOSED';
  if (hasSentTransactions && txCount > 20) return 'ROTATION_RECOMMENDED';
  return 'UNKNOWN';
}

function recommendation(status: ExposureStatus) {
  if (status === 'SAFE') {
    return 'No known outgoing transactions. Public key exposure appears low.';
  }

  if (status === 'WATCHLIST') {
    return 'Signed activity detected. Monitor exposure and consider rotation.';
  }

  if (status === 'EXPOSED') {
    return 'Public key exposure risk detected. Address rotation is recommended.';
  }

  if (status === 'ROTATION_RECOMMENDED') {
    return 'High activity detected. Rotate into a fresh address when possible.';
  }

  if (status === 'PROTECTED') {
    return 'Asset is marked as protected through Ron1n address hygiene.';
  }

  return 'Exposure unknown. Live provider scanning will connect in the next phase.';
}

export class QuantumExposureService {
  static async scanAsset(symbol: string, address: string): Promise<QuantumExposureRecord> {
    const existing = await this.getExposure(symbol);

    const txCount = existing?.txCount ?? 0;
    const hasSentTransactions = existing?.hasSentTransactions ?? false;
    const status = existing?.status ?? classify(txCount, hasSentTransactions);

    const record: QuantumExposureRecord = {
      symbol,
      address,
      txCount,
      hasSentTransactions,
      publicKeyExposed: hasSentTransactions,
      status,
      recommendation: recommendation(status),
      updatedAt: new Date().toISOString(),
    };

    await this.saveExposure(record);
    return record;
  }

  static async simulateActivity(symbol: string, address: string, txCount: number) {
    const hasSentTransactions = txCount > 0;
    const status = classify(txCount, hasSentTransactions);

    const record: QuantumExposureRecord = {
      symbol,
      address,
      txCount,
      hasSentTransactions,
      publicKeyExposed: hasSentTransactions,
      status,
      recommendation: recommendation(status),
      updatedAt: new Date().toISOString(),
    };

    await this.saveExposure(record);
    return record;
  }

  static async markProtected(symbol: string, address: string) {
    const record: QuantumExposureRecord = {
      symbol,
      address,
      txCount: 0,
      hasSentTransactions: false,
      publicKeyExposed: false,
      status: 'PROTECTED',
      recommendation: recommendation('PROTECTED'),
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