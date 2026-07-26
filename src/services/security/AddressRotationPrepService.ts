import AsyncStorage from '@react-native-async-storage/async-storage';
import { AssetExposureReport } from './ExposureScannerService';

export type RotationPrepStatus = 'PREPARED' | 'DISMISSED' | 'COMPLETED';

export type AddressRotationPrepRecord = {
  id: string;
  symbol: string;
  exposureLevel: AssetExposureReport['exposureLevel'];
  transactionCount: number;
  providerStatus: AssetExposureReport['providerStatus'];
  recommendedLabel: string;
  reason: string;
  safetyNote: string;
  status: RotationPrepStatus;
  createdAt: string;
  updatedAt: string;
};

const ROTATION_PREP_KEY = 'ron1n_address_rotation_prep_v1';
const MAX_ROTATION_PREP_RECORDS = 100;

function buildRecommendedLabel(symbol: string) {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}${String(date.getDate()).padStart(2, '0')}`;

  return `${symbol}-FRESH-RECEIVE-${stamp}`;
}

function buildReason(report: AssetExposureReport) {
  if (report.exposureLevel === 'ELEVATED') {
    return `${report.symbol} has elevated public exposure with ${report.transactionCount} cached transactions. Fresh receive address preparation is recommended.`;
  }

  if (report.exposureLevel === 'LOW') {
    return `${report.symbol} has light public exposure. Preparing a fresh receive address improves address hygiene.`;
  }

  if (report.exposureLevel === 'UNKNOWN') {
    return `${report.symbol} exposure is unknown because provider data was unavailable. Retry sync before relying on this address.`;
  }

  return `${report.symbol} appears fresh. Rotation is optional.`;
}

export class AddressRotationPrepService {
  static async prepare(report: AssetExposureReport): Promise<AddressRotationPrepRecord> {
    const now = new Date().toISOString();

    const record: AddressRotationPrepRecord = {
      id: `${report.symbol}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      symbol: report.symbol,
      exposureLevel: report.exposureLevel,
      transactionCount: report.transactionCount,
      providerStatus: report.providerStatus,
      recommendedLabel: buildRecommendedLabel(report.symbol),
      reason: buildReason(report),
      safetyNote:
        'This is a local preparation record only. Ron1n does not move funds, sign transactions, broadcast transactions, or custody assets.',
      status: 'PREPARED',
      createdAt: now,
      updatedAt: now,
    };

    const current = await this.getAll();
    const next = [record, ...current].slice(0, MAX_ROTATION_PREP_RECORDS);

    await AsyncStorage.setItem(ROTATION_PREP_KEY, JSON.stringify(next));

    return record;
  }

  static async getAll(): Promise<AddressRotationPrepRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(ROTATION_PREP_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
    } catch (error) {
      console.warn('Failed to read address rotation prep records:', error);
      return [];
    }
  }

  static async getBySymbol(symbol: string): Promise<AddressRotationPrepRecord[]> {
    const records = await this.getAll();
    const normalized = symbol.toUpperCase();

    return records.filter((record) => record.symbol.toUpperCase() === normalized);
  }

  static async updateStatus(
    id: string,
    status: RotationPrepStatus
  ): Promise<void> {
    const current = await this.getAll();

    const next = current.map((record) =>
      record.id === id
        ? {
            ...record,
            status,
            updatedAt: new Date().toISOString(),
          }
        : record
    );

    await AsyncStorage.setItem(ROTATION_PREP_KEY, JSON.stringify(next));
  }

  static async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(ROTATION_PREP_KEY);
  }
}