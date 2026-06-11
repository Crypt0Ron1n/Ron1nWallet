import { QuantumExposureRecord } from './QuantumExposureService';

export class SecurityScoreService {
  static calculate(records: QuantumExposureRecord[]) {
    if (records.length === 0) return 92;

    let score = 100;

    for (const record of records) {
      if (record.status === 'EXPOSED') score -= 12;
      if (record.status === 'UNKNOWN') score -= 5;
      if (record.status === 'MIGRATION_READY') score -= 4;
      if (record.status === 'PROTECTED') score += 2;
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