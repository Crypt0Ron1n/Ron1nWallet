import * as LocalAuthentication from 'expo-local-authentication';
import { ethers } from 'ethers';
import type { SignedPayload } from './types';
import type { TransactionIntent } from '../transactions/TransactionIntent';

export type BroadcastAuthorization = {
  authorizationId: string;
  intentId: string;
  accountId: string;
  transactionHash: string;
  authorizedAt: number;
  method: 'BIOMETRIC';
};

export type BroadcastAuthorizationResult =
  | { authorized: true; authorization: BroadcastAuthorization }
  | { authorized: false; reason: string };

const MAX_AUTHORIZATION_AGE_MS = 5 * 60 * 1000;
const consumedAuthorizationIds = new Set<string>();

function assertEvmSignedPayload(
  signed: SignedPayload
): asserts signed is Extract<SignedPayload, { chain: 'EVM' }> {
  if (signed.chain !== 'EVM' || signed.kind !== 'RAW_TRANSACTION') {
    throw new Error(
      'Broadcast authorization blocked: only signed EVM raw transactions are enabled.'
    );
  }

  if (!/^0x[0-9a-fA-F]+$/.test(signed.rawTransaction)) {
    throw new Error(
      'Broadcast authorization blocked: malformed signed transaction.'
    );
  }

  try {
    const parsed = ethers.Transaction.from(signed.rawTransaction);

    if (parsed.type !== 0 && parsed.type !== 2) {
      throw new Error(
        'Broadcast authorization blocked: unsupported EVM transaction type. Only legacy (type 0) and EIP-1559 (type 2) transactions are enabled.'
      );
    }

    if (!parsed.signature || !parsed.from) {
      throw new Error(
        'Broadcast authorization blocked: transaction is not signed.'
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Broadcast authorization blocked:')) {
      throw error;
    }
    throw new Error(
      'Broadcast authorization blocked: signed transaction is invalid.'
    );
  }
}

export class BroadcastAuthorizationService {
  static async authorize(
    intent: TransactionIntent,
    signed: SignedPayload
  ): Promise<BroadcastAuthorizationResult> {
    try {
      assertEvmSignedPayload(signed);

      if (!intent.intentId || !intent.accountId) {
        return {
          authorized: false,
          reason: 'Transaction identity is incomplete.',
        };
      }

      const transactionHash = ethers.keccak256(signed.rawTransaction);
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        return {
          authorized: false,
          reason:
            'Biometric authentication is required and is not available on this device.',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authorize blockchain broadcast',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });

      if (!result.success) {
        return {
          authorized: false,
          reason: 'Biometric broadcast authorization was cancelled or failed.',
        };
      }

      const authorization: BroadcastAuthorization = {
        authorizationId: `broadcast-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}`,
        intentId: intent.intentId,
        accountId: intent.accountId,
        transactionHash,
        authorizedAt: Date.now(),
        method: 'BIOMETRIC',
      };

      return { authorized: true, authorization };
    } catch (error) {
      return {
        authorized: false,
        reason:
          error instanceof Error
            ? error.message
            : 'Broadcast authorization failed.',
      };
    }
  }

  static assertValid(
    intent: TransactionIntent,
    signed: SignedPayload,
    authorization: BroadcastAuthorization
  ): void {
    assertEvmSignedPayload(signed);

    if (consumedAuthorizationIds.has(authorization.authorizationId)) {
      throw new Error('Broadcast authorization has already been consumed.');
    }

    const age = Date.now() - authorization.authorizedAt;
    if (age < 0 || age > MAX_AUTHORIZATION_AGE_MS) {
      throw new Error('Broadcast authorization has expired.');
    }

    if (authorization.intentId !== intent.intentId) {
      throw new Error('Broadcast authorization intent mismatch.');
    }

    if (authorization.accountId !== intent.accountId) {
      throw new Error('Broadcast authorization account mismatch.');
    }

    const transactionHash = ethers.keccak256(signed.rawTransaction);
    if (
      authorization.transactionHash.toLowerCase() !==
      transactionHash.toLowerCase()
    ) {
      throw new Error(
        'Broadcast authorization transaction mismatch.'
      );
    }
  }

  static consume(authorizationId: string): void {
    if (!authorizationId) {
      throw new Error('Cannot consume an empty broadcast authorization ID.');
    }

    consumedAuthorizationIds.add(authorizationId);
  }
}


