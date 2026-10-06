import type { TransactionIntent } from './TransactionIntent';
import type { SecurityPolicyResult } from '../SecurityPolicyEngine';

export type TransactionReviewSnapshot = {
  intentId: string;
  accountId: string;
  asset: string;
  chain: string;
  from: string;
  to: string;
  amount: string;
  amountUnit: string;
  securityProfile: string;
  policyDecision: string;
  policyVersion: string;
  requiresRotation: boolean;
  requiresMigration: boolean;
  reviewedAt: string;
};

export class TransactionReviewService {
  static createSnapshot(
    intent: TransactionIntent,
    policy: SecurityPolicyResult
  ): TransactionReviewSnapshot {
    return {
      intentId: intent.intentId,
      accountId: intent.accountId,
      asset: intent.asset.symbol,
      chain: intent.asset.chain,
      from: intent.from,
      to: intent.to,
      amount: intent.amount,
      amountUnit: intent.amountUnit,
      securityProfile: intent.securityProfile,
      policyDecision: policy.decision,
      policyVersion: policy.policyVersion,
      requiresRotation: policy.requiresRotation,
      requiresMigration: policy.requiresMigration,
      reviewedAt: new Date().toISOString(),
    };
  }
}
