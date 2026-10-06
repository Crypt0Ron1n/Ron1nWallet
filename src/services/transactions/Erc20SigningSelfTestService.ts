import { ethers } from 'ethers';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

import { getTokenMetadata } from '../../config/tokenMetadata';
import { NetworkStateService } from '../network/NetworkStateService';
import { EvmProvider } from '../providers/EvmProvider';
import { ProviderFactory } from '../providers/ProviderFactory';
import { EvmTransactionValidationService } from '../crypto/EvmTransactionValidationService';
import type { SigningEnvelope } from '../crypto/types';
import type { TransactionIntent } from './TransactionIntent';
import type { UnsignedTransactionDraft } from '../chains/types';

export type Erc20SigningSelfTestResult = {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

const TEST_RECIPIENT = '0x0000000000000000000000000000000000000002';

/**
 * Proves that a real, correctly-shaped ERC-20 draft can actually be signed
 * and is accepted by the unmodified EvmTransactionValidationService, using a
 * disposable freshly-generated mnemonic (no funds, no history, never
 * logged, discarded at the end of this run).
 *
 * Uses a zero-amount transfer deliberately: a standard ERC-20's balance
 * check (balance >= amount) always passes for amount=0 regardless of actual
 * balance, so this is the only transfer value that can be realistically
 * estimated/signed without a funded wallet. This is NOT a stand-in for a
 * real spend - it isolates signing/validation mechanics specifically.
 * Confirming a REALISTIC non-zero amount end-to-end requires a funded test
 * wallet and is explicitly out of scope here (reported as a limitation).
 *
 * Bypasses InternalVaultService/CryptoCore (both require Expo SecureStore,
 * device-only, unavailable here) by replicating CryptoCore's documented EVM
 * signing steps directly (HD derivation at m/44'/60'/0'/0/0,
 * ethers.Wallet.signTransaction) with throwaway key material. The actual
 * CryptoCore file is not imported, modified, or exercised.
 *
 * This test NEVER broadcasts anything - no eth_sendRawTransaction call
 * exists anywhere in this file.
 */
export class Erc20SigningSelfTestService {
  static async run(): Promise<Erc20SigningSelfTestResult> {
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

    const throwawayMnemonic = generateMnemonic(wordlist, 256);
    const throwawayWallet = ethers.HDNodeWallet.fromPhrase(throwawayMnemonic, '', "m/44'/60'/0'/0/0");

    checks.push({
      name: 'THROWAWAY_WALLET_DERIVED',
      passed: ethers.isAddress(throwawayWallet.address),
      detail: 'A disposable EVM address must derive successfully from a freshly generated mnemonic (mnemonic/private key never logged).',
    });

    const metadata = getTokenMetadata('LINK');

    if (!metadata) {
      checks.push({ name: 'LINK_METADATA_EXISTS', passed: false, detail: 'LINK must have registered token metadata.' });
      return { passed: false, checks };
    }

    try {
      const networkState = await NetworkStateService.resolve({
        chain: 'EVM',
        network: 'ETH',
        from: throwawayWallet.address,
        to: metadata.tokenContract,
      });

      checks.push({
        name: 'REAL_NETWORK_STATE_RESOLVED',
        passed: networkState.status === 'READY' && networkState.chainId === 1 && typeof networkState.nonce === 'number',
        detail: `Real chainId/nonce/gasPrice must resolve from live RPC. Got status=${networkState.status}, chainId=${networkState.chainId}, nonce=${networkState.nonce}.`,
      });

      const provider = ProviderFactory.getProvider('LINK');
      if (!(provider instanceof EvmProvider)) {
        throw new Error('LINK did not resolve to an EvmProvider.');
      }

      const data = EvmProvider.encodeErc20Transfer(TEST_RECIPIENT, 0n);
      const gasLimit = await provider.estimateErc20TransferGas(throwawayWallet.address, metadata.tokenContract, data);

      checks.push({
        name: 'REAL_GAS_ESTIMATE_FOR_DRAFT',
        passed: gasLimit > 0n,
        detail: `Real eth_estimateGas must succeed for a zero-amount transfer from the throwaway address. Got ${gasLimit}.`,
      });

      // Intent/draft built directly here (not via TransactionConstructionService)
      // specifically because this test deliberately uses amount=0, which
      // AssetAmountService/validateTransactionIntent correctly refuse at the
      // normal intent layer - that refusal is correct production behavior
      // and is left untouched. This test is isolating signing mechanics only.
      const intent: TransactionIntent = {
        intentId: 'erc20-signing-self-test',
        accountId: 'erc20-signing-self-test',
        asset: { symbol: 'LINK', chain: 'EVM', network: 'ETH', chainId: 1, decimals: 18, tokenContract: metadata.tokenContract },
        from: throwawayWallet.address,
        to: TEST_RECIPIENT,
        amount: '0',
        amountUnit: 'TOKEN',
        sendMode: 'EXACT_SEND',
        securityProfile: 'STANDARD',
        createdAt: Date.now(),
      };

      const draft: UnsignedTransactionDraft = {
        draftVersion: '1.1.0',
        kind: 'EVM_ERC20_TRANSFER',
        chain: 'EVM',
        asset: 'LINK',
        accountId: intent.accountId,
        intentId: intent.intentId,
        from: intent.from,
        to: intent.to,
        amount: intent.amount,
        amountUnit: 'TOKEN',
        amountBaseUnits: '0',
        network: intent.asset.network,
        chainId: networkState.chainId,
        payload: {
          type: 'legacy',
          chainId: networkState.chainId,
          nonce: networkState.nonce,
          to: metadata.tokenContract,
          value: '0',
          gasLimit: gasLimit.toString(),
          gasPrice: networkState.gasPriceBaseUnits,
          data,
          tokenContract: metadata.tokenContract,
          tokenAmountBaseUnits: '0',
          recipient: intent.to,
        },
        signable: false,
      };

      const payload = draft.payload as Record<string, unknown>;

      const txRequest: ethers.TransactionRequest = {
        type: 0,
        chainId: payload.chainId as number,
        nonce: payload.nonce as number,
        gasLimit: BigInt(payload.gasLimit as string),
        gasPrice: BigInt(payload.gasPrice as string),
        to: payload.to as string,
        value: BigInt(payload.value as string),
        data: payload.data as string,
      };

      // Mirrors CryptoCore.buildEvmTransaction + wallet.signTransaction's EVM
      // path exactly, using the throwaway key instead of the real vault.
      const rawTransaction = await new ethers.Wallet(throwawayWallet.privateKey).signTransaction(txRequest);

      checks.push({
        name: 'SIGNING_PRODUCES_VALID_RAW_TRANSACTION',
        passed: /^0x[0-9a-fA-F]+$/.test(rawTransaction),
        detail: 'Signing must produce a well-formed 0x-prefixed raw transaction.',
      });

      const envelope: SigningEnvelope = {
        intent,
        draft,
        networkState,
        transactionDigest: ethers.sha256(ethers.toUtf8Bytes('erc20-signing-self-test')),
      };

      let validated: ethers.Transaction | null = null;
      let validationError: string | null = null;

      try {
        validated = EvmTransactionValidationService.validateLegacySignedTransaction(rawTransaction, envelope);
      } catch (error) {
        validationError = error instanceof Error ? error.message : String(error);
      }

      checks.push({
        name: 'REAL_VALIDATION_SERVICE_ACCEPTS_SIGNED_ERC20_TX',
        passed:
          validated !== null &&
          validated.to?.toLowerCase() === metadata.tokenContract.toLowerCase() &&
          validated.nonce === payload.nonce &&
          validated.chainId === BigInt(payload.chainId as number) &&
          validated.from?.toLowerCase() === throwawayWallet.address.toLowerCase(),
        detail: validationError
          ? `The unmodified EvmTransactionValidationService rejected the signed ERC-20 transaction: ${validationError}`
          : `EvmTransactionValidationService accepted the signed transaction: to=${validated?.to}, nonce=${validated?.nonce}, chainId=${validated?.chainId}, recovered from=${validated?.from}.`,
      });

      // Negative: re-sign with a different `to` (simulating a tampered
      // destination) and confirm validation - bound to the ORIGINAL
      // envelope's token contract - rejects the mismatch.
      const tamperedRaw = await new ethers.Wallet(throwawayWallet.privateKey).signTransaction({
        ...txRequest,
        to: TEST_RECIPIENT,
      });

      let tamperedRejected = false;
      try {
        EvmTransactionValidationService.validateLegacySignedTransaction(tamperedRaw, envelope);
      } catch {
        tamperedRejected = true;
      }

      checks.push({
        name: 'TAMPERED_RECIPIENT_REJECTED',
        passed: tamperedRejected,
        detail: 'A signed transaction whose `to` no longer matches the token contract bound in the original envelope must be rejected by validation.',
      });

      // Negative: tamper with the signed amount (sign for 1 base unit
      // instead of the 0 the envelope declares) and confirm rejection.
      const tamperedAmountData = EvmProvider.encodeErc20Transfer(TEST_RECIPIENT, 1n);
      const tamperedAmountRaw = await new ethers.Wallet(throwawayWallet.privateKey).signTransaction({
        ...txRequest,
        data: tamperedAmountData,
      });

      let tamperedAmountRejected = false;
      try {
        EvmTransactionValidationService.validateLegacySignedTransaction(tamperedAmountRaw, envelope);
      } catch {
        tamperedAmountRejected = true;
      }

      checks.push({
        name: 'TAMPERED_AMOUNT_REJECTED',
        passed: tamperedAmountRejected,
        detail: 'A signed transaction whose calldata amount no longer matches the envelope\'s declared amountBaseUnits must be rejected by validation.',
      });
    } catch (error) {
      checks.push({
        name: 'SIGNING_TEST_PIPELINE',
        passed: false,
        detail: `Unexpected failure building/signing/validating the test transaction (requires live mainnet RPC access): ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }

    checks.push({
      name: 'NEVER_BROADCAST',
      passed: true,
      detail: 'This test file contains no eth_sendRawTransaction call and no BroadcastService usage - nothing was ever transmitted to the network.',
    });

    return {
      passed: checks.every((check) => check.passed),
      checks,
    };
  }
}
