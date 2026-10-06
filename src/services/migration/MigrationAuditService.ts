import { ActivityService } from '../transactions/ActivityService';
import type { AssetMigrationPlan } from './types';

export type MigrationAuditStage =
  | 'PLAN_CREATED'
  | 'PLAN_BLOCKED'
  | 'AUTHORIZATION_STARTED'
  | 'SIGNED'
  | 'BROADCAST'
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED';

function safeStageTitle(stage: MigrationAuditStage): string {
  switch (stage) {
    case 'PLAN_CREATED':
      return 'Migration Plan Created';
    case 'PLAN_BLOCKED':
      return 'Migration Plan Blocked';
    case 'AUTHORIZATION_STARTED':
      return 'Migration Authorization Started';
    case 'SIGNED':
      return 'Migration Transaction Signed';
    case 'BROADCAST':
      return 'Migration Broadcast';
    case 'PENDING':
      return 'Migration Pending';
    case 'CONFIRMED':
      return 'Migration Confirmed';
    case 'FAILED':
      return 'Migration Failed';
  }
}

export class MigrationAuditService {
  static async record(
    stage: MigrationAuditStage,
    plan: AssetMigrationPlan,
    detail?: string
  ): Promise<void> {
    const source = plan.sourceAddress;
    const destination = plan.destinationAddress;

    // Audit records contain only public transaction metadata. Never include
    // mnemonic material, private keys, signing secrets, or raw signed payloads.
    const route = `${source} → ${destination}`;
    const suffix = detail ? ` ${detail}` : '';

    await ActivityService.addActivity(
      stage === 'PLAN_BLOCKED' || stage === 'FAILED' ? 'ERROR' : 'SECURITY',
      safeStageTitle(stage),
      `${plan.intent.asset.symbol} migration ${route}.${suffix}`.trim()
    );
  }
}
