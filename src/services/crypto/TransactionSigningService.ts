import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';

import { CryptoCore } from './CryptoCore';
import { litecoinNetwork } from './litecoinNetwork';
import type {
  DerivationReference,
  SignedPayload,
  SigningAuthorization,
  SignRequest,
  SigningEnvelope,
} from './types';
import type { TransactionConstructionResult } from '../chains/types';
import type { TransactionIntent } from '../transactions/TransactionIntent';
import { validateTransactionIntent } from '../transactions/TransactionIntent';

export type TransactionSigningRequest = {
  intent: TransactionIntent;
  construction: TransactionConstructionResult;
  authorization: SigningAuthorization;
  derivationRef: DerivationReference;
};

function assertAuthorizationMatches(
  intent: TransactionIntent,
  digest: string,
  authorization: SigningAuthorization
): void {
  if (authorization.intentId !== intent.intentId) {
    throw new Error('Signing orchestration blocked: authorization intent mismatch');
  }

  if (authorization.accountId !== intent.accountId) {
    throw new Error('Signing orchestration blocked: authorization account mismatch');
  }

  if (authorization.transactionDigest !== digest) {
    throw new Error(
      'Signing orchestration blocked: authorization is not bound to this transaction'
    );
  }

  if (authorization.policyDecision === 'BLOCK') {
    throw new Error(
      'Signing orchestration blocked: policy authorization is BLOCK'
    );
  }
}

function buildEnvelope(
  request: TransactionSigningRequest
): SigningEnvelope {
  const validation = validateTransactionIntent(request.intent);

  if (!validation.valid) {
    throw new Error(
      `Signing orchestration blocked: invalid transaction intent (${validation.codes.join(', ')})`
    );
  }

  if (
    request.construction.transactionDigest !==
    request.authorization.transactionDigest
  ) {
    throw new Error(
      'Signing orchestration blocked: construction and authorization digests differ'
    );
  }

  if (request.construction.draft.signable !== false) {
    throw new Error(
      'Signing orchestration blocked: construction artifact crossed the unsigned boundary'
    );
  }

  if (request.construction.draft.chain !== request.intent.asset.chain) {
    throw new Error(
      'Signing orchestration blocked: construction chain does not match intent chain'
    );
  }

  if (request.construction.draft.intentId !== request.intent.intentId) {
    throw new Error(
      'Signing orchestration blocked: construction intent does not match authorization intent'
    );
  }

  assertAuthorizationMatches(
    request.intent,
    request.construction.transactionDigest,
    request.authorization
  );

  return {
    intent: request.intent,
    draft: request.construction.draft,
    networkState: request.construction.networkState,
    transactionDigest: request.construction.transactionDigest,
  };
}

/**
 * Application-facing signing orchestrator.
 *
 * Responsibilities:
 * - combine the already-authorized intent and construction result;
 * - bind them to the exact transaction digest;
 * - invoke CryptoCore without exposing secrets;
 * - independently verify the returned EVM raw transaction.
 *
 * This service does not access SecureStore and does not broadcast.
 */
export class TransactionSigningService {
  static async sign(
    request: TransactionSigningRequest
  ): Promise<SignedPayload> {
    const envelope = buildEnvelope(request);

    if (request.derivationRef.index < 0 ||
        !Number.isSafeInteger(request.derivationRef.index)) {
      throw new Error('Signing orchestration blocked: invalid derivation index');
    }

    const signRequest: SignRequest = {
      requestId: `sign-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`,
      chain: request.intent.asset.chain,
      accountId: request.intent.accountId,
      derivationRef: request.derivationRef,
      envelope,
      authorization: request.authorization,
    };

    const signed = await CryptoCore.signTransaction(signRequest);

    this.verifySignedPayload(signed, envelope);

    return signed;
  }

  /**
   * Independent post-sign verification.
   *
   * This checks that the returned signed bytes correspond to the same
   * authorized chain and transaction intent. It does not broadcast.
   */
  static verifySignedPayload(
    signed: SignedPayload,
    envelope: SigningEnvelope
  ): void {
    if (signed.transactionDigest !== envelope.transactionDigest) {
      throw new Error(
        'Signed transaction verification failed: digest mismatch'
      );
    }

    if (signed.chain !== envelope.intent.asset.chain) {
      throw new Error(
        'Signed transaction verification failed: chain mismatch'
      );
    }

    if (signed.kind !== 'RAW_TRANSACTION') {
      if (envelope.intent.asset.chain === 'EVM') {
        throw new Error(
          'Signed transaction verification failed: EVM payload is not raw transaction bytes'
        );
      }

      return;
    }

    if (signed.chain === 'BITCOIN' || signed.chain === 'LITECOIN') {
      this.verifyUtxoSignedPayload(signed, envelope);
      return;
    }

    if (signed.chain !== 'EVM') {
      throw new Error(
        'Signed transaction verification failed: raw transaction type is unsupported for this verifier'
      );
    }

    if (!/^0x[0-9a-fA-F]+$/.test(signed.rawTransaction)) {
      throw new Error(
        'Signed transaction verification failed: malformed raw transaction'
      );
    }

    const parsed = ethers.Transaction.from(signed.rawTransaction);

    if (!parsed.signature) {
      throw new Error(
        'Signed transaction verification failed: transaction is not signed'
      );
    }

    if (envelope.draft.payload.chainId !== Number(parsed.chainId)) {
      throw new Error(
        'Signed transaction verification failed: chain ID mismatch'
      );
    }

    if (typeof envelope.draft.payload.nonce !== 'number' ||
        parsed.nonce !== envelope.draft.payload.nonce) {
      throw new Error(
        'Signed transaction verification failed: nonce mismatch'
      );
    }

    const expectedRecipient = envelope.intent.to.toLowerCase();

    if (
      envelope.intent.amountUnit === 'NATIVE' &&
      parsed.to?.toLowerCase() !== expectedRecipient
    ) {
      throw new Error(
        'Signed transaction verification failed: recipient mismatch'
      );
    }

    if (
      envelope.intent.amountUnit === 'NATIVE' &&
      parsed.value !== BigInt(envelope.draft.payload.value as string)
    ) {
      throw new Error(
        'Signed transaction verification failed: amount mismatch'
      );
    }

    if (
      typeof envelope.draft.payload.data !== 'string' ||
      parsed.data.toLowerCase() !==
        (envelope.draft.payload.data as string).toLowerCase()
    ) {
      throw new Error(
        'Signed transaction verification failed: transaction data mismatch'
      );
    }
  }

  /**
   * Independent re-check for Bitcoin/Litecoin: re-parse the raw signed
   * transaction and confirm every output in the draft is actually present,
   * with the exact expected value, rather than trusting construction+signing.
   */
  private static verifyUtxoSignedPayload(
    signed: SignedPayload & { chain: 'BITCOIN' | 'LITECOIN'; kind: 'RAW_TRANSACTION' },
    envelope: SigningEnvelope
  ): void {
    if (!/^[0-9a-fA-F]+$/.test(signed.rawTransaction)) {
      throw new Error(
        'Signed transaction verification failed: malformed raw transaction'
      );
    }

    const network = signed.chain === 'BITCOIN' ? bitcoin.networks.bitcoin : litecoinNetwork;
    const parsed = bitcoin.Transaction.fromHex(signed.rawTransaction);

    if (parsed.ins.length === 0 || !parsed.ins.every((input) => input.witness.length > 0)) {
      throw new Error(
        'Signed transaction verification failed: transaction is not signed'
      );
    }

    const payload = envelope.draft.payload as {
      inputs: ReadonlyArray<{ txid: string; vout: number }>;
      outputs: ReadonlyArray<{ address: string; valueBaseUnits: string }>;
    };

    if (
      !Array.isArray(payload.inputs) ||
      parsed.ins.length !== payload.inputs.length
    ) {
      throw new Error(
        'Signed transaction verification failed: input count mismatch'
      );
    }

    if (!Array.isArray(payload.outputs) || payload.outputs.length === 0) {
      throw new Error(
        'Signed transaction verification failed: missing expected outputs'
      );
    }

    for (const output of payload.outputs) {
      const expectedScript = bitcoin.address.toOutputScript(output.address, network);
      const matches = parsed.outs.some(
        (out) =>
          Buffer.from(out.script).equals(expectedScript) &&
          out.value === BigInt(output.valueBaseUnits)
      );

      if (!matches) {
        throw new Error(
          'Signed transaction verification failed: expected output not found in signed transaction'
        );
      }
    }
  }
}

