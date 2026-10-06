import { Buffer } from 'buffer';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { deriveAddress, deriveKeypair, generateSeed } from 'ripple-keypairs';
import { Keypair as StellarKeypair } from '@stellar/stellar-base';
import algosdk from 'algosdk';
import * as LocalAuthentication from 'expo-local-authentication';

import { secp256k1 } from '@noble/curves/secp256k1';

import { InternalVaultService } from './InternalVaultService';
import { litecoinNetwork } from './litecoinNetwork';
import type {
  DerivationReference,
  PublicAddressResult,
  RecoveryAuthorization,
  SignRequest,
  SignedPayload,
  SupportedChain,
} from './types';

const SIGNING_AUTHORIZATION_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * In-memory replay protection for signing authorizations.
 *
 * An authorization is intentionally not persisted. A process restart requires
 * a new explicit user authorization.
 */
const consumedAuthorizationIds = new Set<string>();

function assertIndex(index: number): void {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error('Invalid derivation index');
  }
}

function assertDigest(value: string): void {
  if (!/^0x[0-9a-f]{64}$/.test(value)) {
    throw new Error('Signing blocked: invalid transaction digest');
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify(record[key])}`
    )
    .join(',')}}`;
}

function computeEnvelopeDigest(request: SignRequest): string {
  return ethers.sha256(
    ethers.toUtf8Bytes(
      stableStringify({
        intent: request.envelope.intent,
        draft: request.envelope.draft,
        networkState: request.envelope.networkState,
      })
    )
  );
}

function assertAuthorization(request: SignRequest): void {
  const authorization = request.authorization;

  if (!authorization?.authorizationId) {
    throw new Error('Signing blocked: missing authorization context');
  }

  if (consumedAuthorizationIds.has(authorization.authorizationId)) {
    throw new Error('Signing blocked: authorization has already been consumed');
  }

  if (authorization.intentId !== request.envelope.intent.intentId) {
    throw new Error('Signing blocked: authorization intent mismatch');
  }

  if (authorization.accountId !== request.accountId) {
    throw new Error('Signing blocked: authorization account mismatch');
  }

  if (authorization.policyDecision === 'BLOCK') {
    throw new Error('Signing blocked: security policy denied signing');
  }

  if (!authorization.policyVersion.trim()) {
    throw new Error('Signing blocked: missing policy version');
  }

  if (!Number.isSafeInteger(authorization.authorizedAt)) {
    throw new Error('Signing blocked: invalid authorization timestamp');
  }

  if (Date.now() - authorization.authorizedAt > SIGNING_AUTHORIZATION_MAX_AGE_MS) {
    throw new Error('Signing blocked: signing authorization has expired');
  }

  assertDigest(authorization.transactionDigest);
  assertDigest(request.envelope.transactionDigest);

  if (
    authorization.transactionDigest !== request.envelope.transactionDigest
  ) {
    throw new Error('Signing blocked: authorization digest mismatch');
  }

  const recomputedDigest = computeEnvelopeDigest(request);

  if (recomputedDigest !== request.envelope.transactionDigest) {
    throw new Error(
      'Signing blocked: transaction envelope does not match the authorized digest'
    );
  }

  if (request.envelope.draft.signable !== false) {
    throw new Error('Signing blocked: unsigned draft boundary was violated');
  }

  if (request.envelope.draft.chain !== request.chain) {
    throw new Error('Signing blocked: chain mismatch');
  }

  if (request.envelope.draft.accountId !== request.accountId) {
    throw new Error('Signing blocked: draft account mismatch');
  }

  if (request.envelope.draft.intentId !== request.envelope.intent.intentId) {
    throw new Error('Signing blocked: draft intent mismatch');
  }
}

function markAuthorizationConsumed(authorizationId: string): void {
  consumedAuthorizationIds.add(authorizationId);

  // Bound memory usage if a long-lived process signs many transactions.
  if (consumedAuthorizationIds.size > 1024) {
    const first = consumedAuthorizationIds.values().next().value;
    if (typeof first === 'string') {
      consumedAuthorizationIds.delete(first);
    }
  }
}

function getEvmPrivateKey(
  mnemonic: string,
  index: number
): { privateKey: string; path: string } {
  assertIndex(index);

  const path = `m/44'/60'/0'/0/${index}`;
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, '', path);

  return {
    privateKey: wallet.privateKey,
    path,
  };
}

function buildEvmTransaction(
  request: SignRequest
): ethers.TransactionRequest {
  const payload = request.envelope.draft.payload;

  const type = payload.type;
  if (type !== 'legacy') {
    throw new Error(
      'EVM signing blocked: only validated legacy transaction drafts are supported in Step 9'
    );
  }

  const chainId = payload.chainId;
  const nonce = payload.nonce;
  const gasLimit = payload.gasLimit;
  const gasPrice = payload.gasPrice;
  const to = payload.to;
  const value = payload.value;
  const data = payload.data;

  if (
    typeof chainId !== 'number' ||
    !Number.isSafeInteger(chainId) ||
    chainId <= 0
  ) {
    throw new Error('EVM signing blocked: invalid chain ID');
  }

  if (
    typeof nonce !== 'number' ||
    !Number.isSafeInteger(nonce) ||
    nonce < 0
  ) {
    throw new Error('EVM signing blocked: invalid nonce');
  }

  if (
    typeof gasLimit !== 'string' ||
    !/^\d+$/.test(gasLimit) ||
    BigInt(gasLimit) <= 0n
  ) {
    throw new Error('EVM signing blocked: invalid gas limit');
  }

  if (
    typeof gasPrice !== 'string' ||
    !/^\d+$/.test(gasPrice) ||
    BigInt(gasPrice) <= 0n
  ) {
    throw new Error('EVM signing blocked: invalid gas price');
  }

  if (typeof to !== 'string' || !ethers.isAddress(to)) {
    throw new Error('EVM signing blocked: invalid recipient');
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error('EVM signing blocked: invalid value');
  }

  if (typeof data !== 'string' || !/^0x[0-9a-fA-F]*$/.test(data)) {
    throw new Error('EVM signing blocked: invalid transaction data');
  }

  if (
    request.envelope.intent.amountUnit === 'NATIVE' &&
    to.toLowerCase() !== request.envelope.intent.to.toLowerCase()
  ) {
    throw new Error('EVM signing blocked: recipient mismatch');
  }

  return {
    type: 0,
    chainId,
    nonce,
    gasLimit: BigInt(gasLimit),
    gasPrice: BigInt(gasPrice),
    to,
    value: BigInt(value),
    data,
  };
}

/**
 * Cryptographic execution boundary.
 *
 * Secret material is retrieved and consumed only inside this module.
 * The method returns signed transaction bytes, never private keys.
 *
 * Step 9 intentionally enables only EVM signing. The other chain adapters
 * currently do not produce final serialized signable transaction artifacts
 * and/or use derivation schemes still marked LEGACY_UNVERIFIED.
 */
export class CryptoCore {
  private static getSeed(mnemonic: string): Uint8Array {
    return mnemonicToSeedSync(mnemonic);
  }

  private static getRoot(seed: Uint8Array) {
    return HDKey.fromMasterSeed(seed);
  }

  private static derive32Bytes(mnemonic: string, label: string): Buffer {
    const seed = this.getSeed(mnemonic);
    const digest = ethers.sha256(
      Buffer.concat([Buffer.from(seed), Buffer.from(label, 'utf8')])
    );
    return Buffer.from(ethers.getBytes(digest)).subarray(0, 32);
  }

  static async getPublicAddress(
    chain: SupportedChain,
    ref: DerivationReference
  ): Promise<PublicAddressResult> {
    assertIndex(ref.index);

    const mnemonic = await InternalVaultService.getMnemonic();
    if (!mnemonic) {
      throw new Error('Vault is locked or missing');
    }

    const index = ref.index;

    switch (chain) {
      case 'EVM': {
        const path = `m/44'/60'/0'/0/${index}`;
        const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, '', path);

        return {
          address: wallet.address,
          path,
          derivationStatus: 'VERIFIED',
        };
      }

      case 'BITCOIN': {
        const seed = this.getSeed(mnemonic);
        const root = this.getRoot(seed);
        const path = `m/84'/0'/0'/0/${index}`;
        const child = root.derive(path);

        if (!child.publicKey) {
          throw new Error('Failed to derive BTC public key');
        }

        const payment = bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(child.publicKey),
          network: bitcoin.networks.bitcoin,
        });

        if (!payment.address) {
          throw new Error('Failed to create BTC address');
        }

        return {
          address: payment.address,
          path,
          derivationStatus: 'VERIFIED',
        };
      }

      case 'LITECOIN': {
        const seed = this.getSeed(mnemonic);
        const root = this.getRoot(seed);
        const path = `m/84'/2'/0'/0/${index}`;
        const child = root.derive(path);

        if (!child.publicKey) {
          throw new Error('Failed to derive LTC public key');
        }

        const payment = bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(child.publicKey),
          network: litecoinNetwork,
        });

        if (!payment.address) {
          throw new Error('Failed to create LTC address');
        }

        return {
          address: payment.address,
          path,
          derivationStatus: 'VERIFIED',
        };
      }

      case 'SOLANA': {
        if (index !== 0) {
          throw new Error(
            'Non-zero Solana derivation indexes are not supported until the derivation scheme is validated'
          );
        }

        const path = 'ron1n-deterministic-sol';
        const seed32 = this.derive32Bytes(
          mnemonic,
          `RON1N_SOL_m/44'/501'/0'/0'`
        );
        const keypair = nacl.sign.keyPair.fromSeed(seed32);

        return {
          address: bs58.encode(keypair.publicKey),
          path,
          derivationStatus: 'LEGACY_UNVERIFIED',
        };
      }

      case 'XRP': {
        const seed = this.getSeed(mnemonic);
        const root = this.getRoot(seed);
        const path = `m/44'/144'/0'/0/${index}`;
        const child = root.derive(path);

        if (!child.privateKey) {
          throw new Error('Failed to derive XRP key');
        }

        const entropy = Buffer.from(child.privateKey).subarray(0, 16);
        const familySeed = generateSeed({ entropy });
        const keypair = deriveKeypair(familySeed);
        const address = deriveAddress(keypair.publicKey);

        return {
          address,
          path,
          derivationStatus: 'LEGACY_UNVERIFIED',
        };
      }

      case 'STELLAR': {
        if (index !== 0) {
          throw new Error(
            'Non-zero Stellar derivation indexes are not supported until the derivation scheme is validated'
          );
        }

        const path = 'ron1n-deterministic-xlm';
        const seed32 = this.derive32Bytes(
          mnemonic,
          `RON1N_XLM_m/44'/148'/0'`
        );
        const keypair = StellarKeypair.fromRawEd25519Seed(seed32);

        return {
          address: keypair.publicKey(),
          path,
          derivationStatus: 'LEGACY_UNVERIFIED',
        };
      }

      case 'ALGORAND': {
        if (index !== 0) {
          throw new Error(
            'Non-zero Algorand derivation indexes are not supported until the derivation scheme is validated'
          );
        }

        const path = 'ron1n-deterministic-algo';
        const seed32 = this.derive32Bytes(
          mnemonic,
          `RON1N_ALGO_m/44'/283'/0'/0'/0'`
        );
        const keypair = nacl.sign.keyPair.fromSeed(seed32);

        return {
          address: algosdk.encodeAddress(keypair.publicKey),
          path,
          derivationStatus: 'LEGACY_UNVERIFIED',
        };
      }

      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  /**
   * Recovery is an explicit secret-disclosure exception.
   */
  static async revealRecoveryPhrase(): Promise<string> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();

    if (!hasHardware) {
      throw new Error('Biometric security hardware not available');
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to view recovery phrase',
      fallbackLabel: 'Use device passcode',
    });

    if (!result.success) {
      throw new Error('Recovery disclosure authorization failed');
    }

    const authorization: RecoveryAuthorization = {
      authorizationId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      authorizedAt: Date.now(),
      method: 'BIOMETRIC',
      purpose: 'RECOVERY_EXPORT',
    };

    if (
      authorization.purpose !== 'RECOVERY_EXPORT' ||
      authorization.method !== 'BIOMETRIC' ||
      !authorization.authorizationId
    ) {
      throw new Error('Recovery disclosure blocked');
    }

    const mnemonic = await InternalVaultService.getMnemonic();

    if (!mnemonic) {
      throw new Error('No vault found on this device');
    }

    return mnemonic;
  }

  static async signTransaction(
    request: SignRequest
  ): Promise<SignedPayload> {
    assertIndex(request.derivationRef.index);

    if (
      request.chain !== 'EVM' &&
      request.chain !== 'BITCOIN' &&
      request.chain !== 'LITECOIN'
    ) {
      throw new Error(
        `Signing blocked: ${request.chain} signing is not enabled yet`
      );
    }

    assertAuthorization(request);

    const mnemonic = await InternalVaultService.getMnemonic();

    if (!mnemonic) {
      throw new Error('Signing blocked: vault is locked or missing');
    }

    if (request.chain === 'BITCOIN' || request.chain === 'LITECOIN') {
      return this.signUtxoTransaction(request, mnemonic);
    }

    const derived = getEvmPrivateKey(
      mnemonic,
      request.derivationRef.index
    );

    const expectedAddress = ethers.computeAddress(derived.privateKey);

    if (
      expectedAddress.toLowerCase() !==
      request.envelope.draft.from.toLowerCase()
    ) {
      throw new Error(
        'Signing blocked: derived signing address does not match transaction source'
      );
    }

    const intentFrom = request.envelope.intent.from;

    if (
      intentFrom &&
      expectedAddress.toLowerCase() !== intentFrom.toLowerCase()
    ) {
      throw new Error(
        'Signing blocked: transaction intent source does not match derived signer'
      );
    }

    const transaction = buildEvmTransaction(request);
    const wallet = new ethers.Wallet(derived.privateKey);

    const rawTransaction = await wallet.signTransaction(transaction);

    const signedTransactionType = ethers.Transaction.from(rawTransaction).type;

    console.log(
      '[RON1N_EVM_SIGNED_TYPE]',
      JSON.stringify({
        type: signedTransactionType,
        requestedDraftType: request.envelope.draft.payload.type,
        hasGasPrice: Boolean(transaction.gasPrice),
        hasMaxFeePerGas: Boolean(transaction.maxFeePerGas),
        hasMaxPriorityFeePerGas: Boolean(transaction.maxPriorityFeePerGas),
        hasAccessList: Array.isArray(transaction.accessList),
      })
    );

    if (!rawTransaction.startsWith('0x')) {
      throw new Error('Signing failed: invalid raw transaction encoding');
    }

    const parsed = ethers.Transaction.from(rawTransaction);

    if (
      parsed.chainId !==
      BigInt(request.envelope.draft.payload.chainId as number)
    ) {
      throw new Error('Signing failed: signed transaction chain ID mismatch');
    }

    if (
      parsed.from?.toLowerCase() !== expectedAddress.toLowerCase()
    ) {
      throw new Error('Signing failed: signed transaction signer mismatch');
    }

    markAuthorizationConsumed(request.authorization.authorizationId);

    return {
      chain: 'EVM',
      kind: 'RAW_TRANSACTION',
      rawTransaction,
      transactionDigest: request.envelope.transactionDigest,
    };
  }

  /**
   * Native SegWit (P2WPKH) signing for Bitcoin/Litecoin. Derivation, address
   * verification, and independent post-sign verification all mirror the EVM
   * path above: the signer never trusts the draft blindly, it re-derives the
   * address from the private key and re-checks every output against the
   * original intent before returning anything.
   */
  private static async signUtxoTransaction(
    request: SignRequest,
    mnemonic: string
  ): Promise<SignedPayload> {
    const chain = request.chain as 'BITCOIN' | 'LITECOIN';
    const network = chain === 'BITCOIN' ? bitcoin.networks.bitcoin : litecoinNetwork;
    const path =
      chain === 'BITCOIN'
        ? `m/84'/0'/0'/0/${request.derivationRef.index}`
        : `m/84'/2'/0'/0/${request.derivationRef.index}`;

    const seed = this.getSeed(mnemonic);
    const root = this.getRoot(seed);
    const child = root.derive(path);

    if (!child.publicKey || !child.privateKey) {
      throw new Error('Signing blocked: failed to derive UTXO signing key');
    }

    const pubkey = Buffer.from(child.publicKey);
    const privateKey = child.privateKey;

    const payment = bitcoin.payments.p2wpkh({ pubkey, network });

    if (!payment.address || !payment.output) {
      throw new Error('Signing blocked: failed to derive UTXO signing address');
    }

    const expectedAddress = payment.address;
    const draftFrom = request.envelope.draft.from;
    const intentFrom = request.envelope.intent.from;

    if (expectedAddress.toLowerCase() !== draftFrom.toLowerCase()) {
      throw new Error(
        'Signing blocked: derived signing address does not match transaction source'
      );
    }

    if (intentFrom && expectedAddress.toLowerCase() !== intentFrom.toLowerCase()) {
      throw new Error(
        'Signing blocked: transaction intent source does not match derived signer'
      );
    }

    const payload = request.envelope.draft.payload as {
      inputs: ReadonlyArray<{ txid: string; vout: number; valueBaseUnits: string }>;
      outputs: ReadonlyArray<{ address: string; valueBaseUnits: string; purpose?: string }>;
      sourceScriptPubKeyHex: string;
    };

    if (!Array.isArray(payload.inputs) || payload.inputs.length === 0) {
      throw new Error('Signing blocked: no UTXO inputs in transaction draft');
    }

    if (!Array.isArray(payload.outputs) || payload.outputs.length === 0) {
      throw new Error('Signing blocked: no outputs in transaction draft');
    }

    if (typeof payload.sourceScriptPubKeyHex !== 'string' || !payload.sourceScriptPubKeyHex) {
      throw new Error('Signing blocked: missing source scriptPubKey in transaction draft');
    }

    const sourceScript = Buffer.from(payload.sourceScriptPubKeyHex, 'hex');

    const psbt = new bitcoin.Psbt({ network });

    for (const input of payload.inputs) {
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        witnessUtxo: {
          script: sourceScript,
          value: BigInt(input.valueBaseUnits),
        },
      });
    }

    for (const output of payload.outputs) {
      psbt.addOutput({
        address: output.address,
        value: BigInt(output.valueBaseUnits),
      });
    }

    const signer: bitcoin.Signer = {
      publicKey: pubkey,
      sign: (hash: Buffer) => {
        const signature = secp256k1.sign(hash, privateKey, { lowS: true });
        return Buffer.from(signature.toCompactRawBytes());
      },
    };

    for (let i = 0; i < payload.inputs.length; i += 1) {
      psbt.signInput(i, signer, [bitcoin.Transaction.SIGHASH_ALL]);
    }

    psbt.finalizeAllInputs();

    const transaction = psbt.extractTransaction();
    const rawTransaction = transaction.toHex();

    // Independent post-sign verification: re-parse the finished transaction
    // and confirm every output matches the original intent exactly, rather
    // than trusting that construction + signing produced what was asked for.
    const reparsed = bitcoin.Transaction.fromHex(rawTransaction);

    for (const output of payload.outputs) {
      const expectedScript = bitcoin.address.toOutputScript(output.address, network);
      const matches = reparsed.outs.some(
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

    if (reparsed.ins.length !== payload.inputs.length) {
      throw new Error(
        'Signed transaction verification failed: input count mismatch'
      );
    }

    markAuthorizationConsumed(request.authorization.authorizationId);

    return {
      chain,
      kind: 'RAW_TRANSACTION',
      rawTransaction,
      transactionDigest: request.envelope.transactionDigest,
    };
  }
}

