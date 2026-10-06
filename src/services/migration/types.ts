import type { SupportedChain } from '../crypto/types';
import type { TransactionIntent } from '../transactions/TransactionIntent';
import type { TransactionConstructionResult } from '../chains/types';
import type { ShogunIdentityRecord } from '../identity/IdentityRegistryService';

export type AssetMigrationPlanStatus =
  | 'READY'
  | 'UNSUPPORTED'
  | 'BLOCKED'
  | 'NO_BALANCE'
  | 'INVALID';

export type MigrationIdentity = Pick<
  ShogunIdentityRecord,
  'identityId' | 'accountId' | 'chain' | 'address' | 'purpose' | 'index' | 'lifecycle'
>;

export type AssetMigrationRequest = {
  accountId: string;
  intent: TransactionIntent;
  sourceIdentity: MigrationIdentity;
  destinationIdentity: MigrationIdentity;
};

export type AssetMigrationPlan = {
  status: AssetMigrationPlanStatus;
  chain: SupportedChain;
  accountId: string;
  intentId: string;
  sourceIdentityId: string;
  destinationIdentityId: string;
  sourceAddress: string;
  destinationAddress: string;
  /** The exact migration transaction intent produced during planning. */
  intent: TransactionIntent;
  reason: string;
  requiresUserAuthorization: boolean;
  requiresBiometricAuthorization: boolean;
  canExecute: boolean;
  createdAt: string;
  construction?: TransactionConstructionResult;
  metadata?: Record<string, string>;
};

export interface ChainMigrationAdapter {
  readonly chain: SupportedChain;
  supports(request: AssetMigrationRequest): boolean;
  prepare(request: AssetMigrationRequest): Promise<AssetMigrationPlan>;
}

export type AssetMigrationAdapterRegistration = {
  adapter: ChainMigrationAdapter;
  enabled: boolean;
};
