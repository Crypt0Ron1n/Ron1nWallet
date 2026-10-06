import type { TransactionConstructionResult } from '../chains/types';
import type { SigningAuthorization, SignedPayload } from '../crypto/types';
import type { ShogunIdentityRecord } from '../identity/IdentityRegistryService';
import type { AssetMigrationPlan } from './types';

export type MigrationSafetyCheckCode =
  | 'PLAN_VALID'
  | 'PLAN_INVALID'
  | 'IDENTITY_INVALID'
  | 'CONSTRUCTION_INVALID'
  | 'AUTHORIZATION_INVALID'
  | 'SIGNED_PAYLOAD_INVALID';

export type MigrationSafetyResult = {
  valid: boolean;
  code: MigrationSafetyCheckCode;
  reason: string;
};

function validIdentity(identity: ShogunIdentityRecord | undefined): boolean {
  return Boolean(
    identity &&
      identity.lifecycle === 'ACTIVE' &&
      identity.address.trim() &&
      Number.isSafeInteger(identity.index) &&
      identity.index >= 0
  );
}

export class MigrationSafetyValidationService {
  static validatePlan(
    plan: AssetMigrationPlan,
    sourceIdentity?: ShogunIdentityRecord,
    destinationIdentity?: ShogunIdentityRecord
  ): MigrationSafetyResult {
    if (
      plan.status !== 'READY' ||
      !plan.canExecute ||
      !plan.requiresUserAuthorization ||
      !plan.requiresBiometricAuthorization ||
      !plan.construction
    ) {
      return {
        valid: false,
        code: 'PLAN_INVALID',
        reason: 'Migration plan is not executable or is missing required authorization/construction data.',
      };
    }

    if (
      plan.intent.intentId !== plan.intentId ||
      plan.intent.accountId !== plan.accountId ||
      plan.intent.from !== plan.sourceAddress ||
      plan.intent.to !== plan.destinationAddress
    ) {
      return {
        valid: false,
        code: 'PLAN_INVALID',
        reason: 'Migration plan intent does not match its declared source, destination, account, or intent ID.',
      };
    }

    if (
      !sourceIdentity ||
      sourceIdentity.identityId !== plan.sourceIdentityId ||
      !validIdentity(sourceIdentity) ||
      sourceIdentity.address !== plan.sourceAddress
    ) {
      return {
        valid: false,
        code: 'IDENTITY_INVALID',
        reason: 'Migration source identity is not active or does not match the plan.',
      };
    }

    if (
      !destinationIdentity ||
      destinationIdentity.identityId !== plan.destinationIdentityId ||
      destinationIdentity.lifecycle !== 'RESERVED' ||
      destinationIdentity.address !== plan.destinationAddress
    ) {
      return {
        valid: false,
        code: 'IDENTITY_INVALID',
        reason: 'Migration destination identity is not reserved or does not match the plan.',
      };
    }

    return {
      valid: true,
      code: 'PLAN_VALID',
      reason: 'Migration plan satisfies identity, intent, and authorization invariants.',
    };
  }

  static validateConstruction(
    plan: AssetMigrationPlan,
    construction: TransactionConstructionResult
  ): MigrationSafetyResult {
    if (construction.transactionDigest !== plan.construction?.transactionDigest) {
      return {
        valid: false,
        code: 'CONSTRUCTION_INVALID',
        reason: 'Construction digest does not match the migration plan.',
      };
    }

    if (
      construction.draft.intentId !== plan.intentId ||
      construction.networkState.status === 'UNAVAILABLE'
    ) {
      return {
        valid: false,
        code: 'CONSTRUCTION_INVALID',
        reason: 'Construction artifact does not match the migration intent or network state.',
      };
    }

    return {
      valid: true,
      code: 'PLAN_VALID',
      reason: 'Construction artifact matches the migration plan.',
    };
  }

  static validateAuthorization(
    plan: AssetMigrationPlan,
    authorization: SigningAuthorization
  ): MigrationSafetyResult {
    if (
      authorization.intentId !== plan.intentId ||
      authorization.accountId !== plan.accountId ||
      authorization.transactionDigest !== plan.construction?.transactionDigest
    ) {
      return {
        valid: false,
        code: 'AUTHORIZATION_INVALID',
        reason: 'Signing authorization is not bound to the migration intent, account, and construction digest.',
      };
    }

    return {
      valid: true,
      code: 'AUTHORIZATION_INVALID',
      reason: 'Signing authorization is correctly bound to the migration transaction.',
    };
  }

  static validateSignedPayload(
    plan: AssetMigrationPlan,
    signed: SignedPayload
  ): MigrationSafetyResult {
    if (signed.transactionDigest !== plan.construction?.transactionDigest) {
      return {
        valid: false,
        code: 'SIGNED_PAYLOAD_INVALID',
        reason: 'Signed payload digest does not match the migration construction digest.',
      };
    }

    return {
      valid: true,
      code: 'SIGNED_PAYLOAD_INVALID',
      reason: 'Signed payload remains bound to the migration construction digest.',
    };
  }
}
