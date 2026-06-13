import { QuantumExposureRecord } from './QuantumExposureService';

export type SecurityScoreInput = {
  biometricsEnabled: boolean;
  vaultProtected: boolean;
  mnemonicBackedUp: boolean;
  records: QuantumExposureRecord[];
  recentRotation: boolean;
};

export class SecurityScoreService {
  static calculate(input: SecurityScoreInput) {
    let score = 0;

    if (input.biometricsEnabled) score += 15;
    if (input.vaultProtected) score += 25;
    if (input.mnemonicBackedUp) score += 20;
    if (input.recentRotation) score += 10;

    if (input.records.length === 0) {
      score += 20;
    } else {
      const total = input.records.reduce((sum, record) => {
        if (record.status === 'SAFE') return sum + 20;
        if (record.status === 'PROTECTED') return sum + 25;
        if (record.status === 'WATCHLIST') return sum + 12;
        if (record.status === 'EXPOSED') return sum + 6;
        if (record.status === 'ROTATION_RECOMMENDED') return sum + 2;
        return sum + 8;
      }, 0);

      score += Math.round(total / input.records.length);
    }

    return Math.max(0, Math.min(100, score));
  }

  static label(score: number) {
    if (score >= 90) return 'ELITE';
    if (score >= 75) return 'STRONG';
    if (score >= 55) return 'MODERATE';
    return 'AT RISK';
  }
}