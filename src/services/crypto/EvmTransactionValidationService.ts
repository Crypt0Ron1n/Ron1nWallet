import { ethers } from 'ethers';

import type { SigningEnvelope } from './types';

/**
 * Pure EVM serialization validation.
 *
 * This helper intentionally accepts only public transaction data. It never
 * receives a private key, mnemonic, SecureStore handle, or signing object.
 *
 * It is suitable for independent validation of a raw transaction produced by
 * CryptoCore and for deterministic signing-vector tests outside the UI.
 */
export class EvmTransactionValidationService {
  static validateLegacySignedTransaction(
    rawTransaction: string,
    envelope: SigningEnvelope
  ): ethers.Transaction {
    if (envelope.intent.asset.chain !== 'EVM') {
      throw new Error(
        'EVM validation blocked: envelope is not an EVM transaction'
      );
    }

    if (envelope.networkState.status !== 'READY') {
      throw new Error(
        'EVM validation blocked: network state is not READY'
      );
    }

    if (!/^0x[0-9a-fA-F]+$/.test(rawTransaction)) {
      throw new Error(
        'EVM validation failed: malformed raw transaction'
      );
    }

    let parsed: ethers.Transaction;

    try {
      parsed = ethers.Transaction.from(rawTransaction);
    } catch {
      throw new Error(
        'EVM validation failed: raw transaction could not be decoded'
      );
    }

    if (parsed.type !== 0 && parsed.type !== 2) {
      throw new Error(
        'EVM validation failed: unsupported transaction type. Only legacy (type 0) and EIP-1559 (type 2) transactions are enabled.'
      );
    }

    if (!parsed.signature || !parsed.from) {
      throw new Error(
        'EVM validation failed: signed transaction has no recoverable signer'
      );
    }

    const payload = envelope.draft.payload;

    if (
      typeof payload.chainId !== 'number' ||
      !Number.isSafeInteger(payload.chainId) ||
      payload.chainId <= 0
    ) {
      throw new Error(
        'EVM validation failed: invalid expected chain ID'
      );
    }

    if (
      typeof payload.nonce !== 'number' ||
      !Number.isSafeInteger(payload.nonce) ||
      payload.nonce < 0
    ) {
      throw new Error(
        'EVM validation failed: invalid expected nonce'
      );
    }

    if (
      typeof payload.gasLimit !== 'string' ||
      !/^\d+$/.test(payload.gasLimit) ||
      BigInt(payload.gasLimit) <= 0n
    ) {
      throw new Error(
        'EVM validation failed: invalid expected gas limit'
      );
    }

    if (
      typeof payload.gasPrice !== 'string' ||
      !/^\d+$/.test(payload.gasPrice) ||
      BigInt(payload.gasPrice) <= 0n
    ) {
      throw new Error(
        'EVM validation failed: invalid expected gas price'
      );
    }

    if (
      typeof payload.value !== 'string' ||
      !/^\d+$/.test(payload.value)
    ) {
      throw new Error(
        'EVM validation failed: invalid expected value'
      );
    }

    if (
      typeof payload.data !== 'string' ||
      !/^0x(?:[0-9a-fA-F]{2})*$/.test(payload.data)
    ) {
      throw new Error(
        'EVM validation failed: invalid expected calldata'
      );
    }

    if (parsed.chainId !== BigInt(payload.chainId)) {
      throw new Error('EVM validation failed: chain ID mismatch');
    }

    if (parsed.nonce !== payload.nonce) {
      throw new Error('EVM validation failed: nonce mismatch');
    }

    if (parsed.gasLimit !== BigInt(payload.gasLimit)) {
      throw new Error('EVM validation failed: gas limit mismatch');
    }

    if (parsed.gasPrice !== BigInt(payload.gasPrice)) {
      throw new Error('EVM validation failed: gas price mismatch');
    }

    if (!parsed.to) {
      throw new Error(
        'EVM validation failed: contract creation is not permitted'
      );
    }

    if (
      parsed.from.toLowerCase() !==
      envelope.draft.from.toLowerCase()
    ) {
      throw new Error('EVM validation failed: signer/source mismatch');
    }

    if (
      envelope.intent.from &&
      parsed.from.toLowerCase() !== envelope.intent.from.toLowerCase()
    ) {
      throw new Error(
        'EVM validation failed: signer/intent source mismatch'
      );
    }

    if (envelope.intent.amountUnit === 'NATIVE') {
      if (
        parsed.to.toLowerCase() !==
        envelope.intent.to.toLowerCase()
      ) {
        throw new Error('EVM validation failed: recipient mismatch');
      }

      if (parsed.value !== BigInt(payload.value)) {
        throw new Error('EVM validation failed: native amount mismatch');
      }

      if (
        parsed.data.toLowerCase() !==
        payload.data.toLowerCase()
      ) {
        throw new Error('EVM validation failed: calldata mismatch');
      }

      return parsed;
    }

    if (envelope.intent.amountUnit !== 'TOKEN') {
      throw new Error(
        'EVM validation failed: unsupported amount unit'
      );
    }

    const tokenContract = envelope.intent.asset.tokenContract;

    if (!tokenContract || !ethers.isAddress(tokenContract)) {
      throw new Error(
        'EVM validation failed: token contract is unresolved'
      );
    }

    if (parsed.to.toLowerCase() !== tokenContract.toLowerCase()) {
      throw new Error(
        'EVM validation failed: token contract mismatch'
      );
    }

    if (parsed.value !== 0n) {
      throw new Error(
        'EVM validation failed: ERC-20 transaction value must be zero'
      );
    }

    if (
      parsed.data.toLowerCase() !==
      payload.data.toLowerCase()
    ) {
      throw new Error(
        'EVM validation failed: ERC-20 calldata mismatch'
      );
    }

    const transferSelector =
      ethers.id('transfer(address,uint256)').slice(0, 10);

    if (
      !parsed.data
        .toLowerCase()
        .startsWith(transferSelector.toLowerCase())
    ) {
      throw new Error(
        'EVM validation failed: unsupported ERC-20 method'
      );
    }

    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['address', 'uint256'],
      `0x${parsed.data.slice(10)}`
    );

    if (
      String(decoded[0]).toLowerCase() !==
      envelope.intent.to.toLowerCase()
    ) {
      throw new Error(
        'EVM validation failed: ERC-20 recipient mismatch'
      );
    }

    if (envelope.draft.amountBaseUnits === undefined) {
      throw new Error(
        'EVM validation failed: token amount metadata is missing'
      );
    }

    if (
      BigInt(decoded[1].toString()) !==
      BigInt(envelope.draft.amountBaseUnits)
    ) {
      throw new Error(
        'EVM validation failed: ERC-20 amount mismatch'
      );
    }

    return parsed;
  }
}

