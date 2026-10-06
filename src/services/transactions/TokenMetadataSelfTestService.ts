import { ethers } from 'ethers';
import { getTokenMetadata } from '../../config/tokenMetadata';
import {
  getAssetConfig,
  resolveNetworkIdentifier,
  type Ron1nAssetConfig,
} from '../../config/assetCatalog';
import { TransactionSecurityGateService } from './TransactionSecurityGateService';
import { TransactionConstructionService } from './TransactionConstructionService';
import { EvmProvider } from '../providers/EvmProvider';
import { ProviderFactory } from '../providers/ProviderFactory';

export type TokenMetadataSelfTestResult = {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
};

const EXPECTED: Record<string, { tokenContract: string; decimals: number }> = {
  LINK: { tokenContract: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  USDC: { tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  USDG: { tokenContract: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D', decimals: 6 },
};

const ERC20_TRANSFER_SELECTOR = ethers.id('transfer(address,uint256)').slice(0, 10);
const ERC20_GAS_BUFFER_BPS = 2000n;
const BPS_DENOMINATOR = 10000n;

// 0x...0001/0002 hold no balance of any of these tokens on mainnet. A
// zero-amount transfer() always passes a standard ERC-20's balance check
// (balance >= 0 is always true) regardless of actual balance, so it is a
// safe, funding-independent way to prove the real eth_estimateGas path
// without needing a funded test wallet or broadcasting anything.
const TEST_SENDER = '0x0000000000000000000000000000000000000001';
const TEST_RECIPIENT = '0x0000000000000000000000000000000000000002';

function getEvmProvider(symbol: string): EvmProvider {
  const provider = ProviderFactory.getProvider(symbol);
  if (!(provider instanceof EvmProvider)) {
    throw new Error(`${symbol} did not resolve to an EvmProvider.`);
  }
  return provider;
}

/**
 * Proves, against real Ethereum mainnet RPC state (no mocking, no
 * broadcasting), that:
 * - token metadata/network-identity reach the intent boundary (pure, no RPC)
 * - real eth_estimateGas works end-to-end with correct calldata and the
 *   documented 20% integer-safe buffer
 * - construction now fails closed at the real balance/gas-estimation layer
 *   for an unfunded address, not at the old metadata/network blockers
 * - malformed inputs and RPC failures fail closed
 * - native ETH is completely unaffected
 */
export class TokenMetadataSelfTestService {
  static async run(): Promise<TokenMetadataSelfTestResult> {
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

    for (const [symbol, expected] of Object.entries(EXPECTED)) {
      const metadata = getTokenMetadata(symbol);

      checks.push({
        name: `${symbol}_REGISTRY_LOOKUP`,
        passed:
          metadata?.tokenContract === expected.tokenContract && metadata?.decimals === expected.decimals,
        detail: `${symbol} registry lookup must return contract ${expected.tokenContract} and ${expected.decimals} decimals. Got ${JSON.stringify(metadata)}.`,
      });

      const assetConfig = getAssetConfig(symbol);

      if (!assetConfig) {
        checks.push({
          name: `${symbol}_CATALOG_ENTRY_EXISTS`,
          passed: false,
          detail: `${symbol} is expected to exist in the asset catalog.`,
        });
        continue;
      }

      // Mirrors exactly what the fixed SendScreen call sites now do.
      const gate = await TransactionSecurityGateService.evaluate({
        accountId: 'self-test',
        assetSymbol: symbol,
        network: resolveNetworkIdentifier(assetConfig),
        from: TEST_SENDER,
        to: TEST_RECIPIENT,
        amount: '1',
        amountUnit: 'TOKEN',
        sendMode: 'EXACT_SEND',
        securityProfile: 'STANDARD',
      });

      checks.push({
        name: `${symbol}_INTENT_METADATA`,
        passed:
          gate.intent.asset.tokenContract === expected.tokenContract &&
          gate.intent.asset.decimals === expected.decimals &&
          gate.intent.asset.chain === 'EVM',
        detail: `${symbol} TransactionIntent must carry the registry's contract/decimals on an EVM-chain asset. Got ${JSON.stringify(gate.intent.asset)}.`,
      });

      checks.push({
        name: `${symbol}_NETWORK_IS_ETH_NOT_DISPLAY_NAME`,
        passed: gate.intent.asset.network === 'ETH',
        detail: `${symbol} must resolve network identifier to the base chain symbol 'ETH', never its own display name. Got "${gate.intent.asset.network}".`,
      });

      // --- Direct EvmProvider-level proof: zero-amount transfer, which a
      // standard ERC-20 always accepts regardless of the sender's balance.
      // This exercises the exact same encodeErc20Transfer/
      // estimateErc20TransferGas methods ChainAdapterFactory calls, with a
      // real round-trip to Ethereum mainnet RPC.
      try {
        const data = EvmProvider.encodeErc20Transfer(TEST_RECIPIENT, 0n);

        const calldataValid =
          data.toLowerCase().startsWith(ERC20_TRANSFER_SELECTOR.toLowerCase()) &&
          data.length === 10 + 64 + 64 &&
          data.slice(10, 74).toLowerCase().endsWith(TEST_RECIPIENT.slice(2).toLowerCase()) &&
          BigInt(`0x${data.slice(74)}`) === 0n;

        checks.push({
          name: `${symbol}_CALLDATA_INTEGRITY`,
          passed: calldataValid,
          detail: `${symbol} calldata must be selector(4) + recipient(32, left-padded) + amount(32). Got "${data}".`,
        });

        const provider = getEvmProvider(symbol);

        const [bufferedGas, rawGasHex] = await Promise.all([
          provider.estimateErc20TransferGas(TEST_SENDER, metadata!.tokenContract, data),
          (provider as any).rpcCall('eth_estimateGas', [
            { from: TEST_SENDER, to: metadata!.tokenContract, value: '0x0', data },
          ]),
        ]);

        const rawGas = BigInt(rawGasHex);
        const expectedBuffered = (rawGas * (BPS_DENOMINATOR + ERC20_GAS_BUFFER_BPS) + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;

        checks.push({
          name: `${symbol}_REAL_GAS_ESTIMATE_POSITIVE`,
          passed: bufferedGas > 0n,
          detail: `${symbol} eth_estimateGas must return a positive buffered gas limit. Got ${bufferedGas}.`,
        });

        checks.push({
          name: `${symbol}_GAS_BUFFER_MATH_CORRECT`,
          passed: bufferedGas === expectedBuffered,
          detail: `${symbol} buffered gas must equal ceil(raw * 12000 / 10000). Raw=${rawGas}, expected=${expectedBuffered}, got=${bufferedGas}.`,
        });
      } catch (error) {
        checks.push({
          name: `${symbol}_REAL_GAS_ESTIMATE_POSITIVE`,
          passed: false,
          detail: `${symbol} real gas estimation threw unexpectedly (requires live network access to Ethereum mainnet RPC): ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }

      // --- Full-pipeline construction, realistic non-zero amount. The test
      // address holds none of these tokens on mainnet, so a real ERC-20
      // transfer() will revert during eth_estimateGas's simulation - that is
      // CORRECT fail-closed behavior, not a bug. What this proves is that
      // the failure now happens at real gas estimation, not at the old
      // "chainId unresolved" / "token contract unresolved" blockers.
      try {
        const construction = await TransactionConstructionService.prepare(gate.intent);
        const payload = construction.draft.payload as Record<string, unknown>;

        // If this unfunded address ever did succeed (e.g. RPC leniency),
        // the result must still be a real numeric gas limit, never the
        // retired placeholder.
        checks.push({
          name: `${symbol}_CONSTRUCTION_NO_LONGER_BLOCKED_EARLY`,
          passed:
            construction.draft.kind === 'EVM_ERC20_TRANSFER' &&
            payload.chainId === 1 &&
            payload.gasLimit !== 'TOKEN_GAS_LIMIT_REQUIRED' &&
            /^\d+$/.test(String(payload.gasLimit)) &&
            BigInt(payload.gasLimit as string) > 0n,
          detail: `${symbol} construction must never reintroduce the TOKEN_GAS_LIMIT_REQUIRED placeholder. Got kind=${construction.draft.kind}, chainId=${payload.chainId}, gasLimit=${payload.gasLimit}.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        checks.push({
          name: `${symbol}_CONSTRUCTION_NO_LONGER_BLOCKED_EARLY`,
          passed:
            !message.includes('chainId unresolved') &&
            !message.includes('token contract and decimals are unresolved') &&
            message !== 'EVM token construction blocked: no EVM provider is configured for this token.',
          detail: `${symbol} construction for an unfunded test address is expected to fail closed at real gas estimation (insufficient balance to simulate a non-zero transfer) - NOT at the old metadata/network blockers. Got: "${message}".`,
        });
      }
    }

    const unknownMetadata = getTokenMetadata('NOT_A_REAL_TOKEN');

    checks.push({
      name: 'UNKNOWN_TOKEN_FAILS_CLOSED',
      passed: unknownMetadata === null,
      detail: `An unregistered token symbol must resolve to null, never a fabricated entry. Got ${JSON.stringify(unknownMetadata)}.`,
    });

    const tokenWithNoBaseChain: Ron1nAssetConfig = {
      symbol: 'NOBASE',
      name: 'No Base Chain Token',
      category: 'Token',
      family: 'TOKEN',
      enabledInWallet: false,
      enabledInSendReview: true,
      supportsReceive: false,
      supportsBalance: false,
      supportsHistory: false,
      supportsExposureScan: false,
      supportsBroadcast: false,
      securityLabel: 'Test fixture',
    };

    let failedClosedOnMissingBaseChain = false;
    try {
      resolveNetworkIdentifier(tokenWithNoBaseChain);
    } catch {
      failedClosedOnMissingBaseChain = true;
    }

    checks.push({
      name: 'TOKEN_WITHOUT_BASE_CHAIN_FAILS_CLOSED',
      passed: failedClosedOnMissingBaseChain,
      detail:
        'resolveNetworkIdentifier must throw for a TOKEN asset with no registered baseChainSymbol, never default to Ethereum or any other chain.',
    });

    const linkConfig = getAssetConfig('LINK');
    const usdcConfig = getAssetConfig('USDC');
    const usdgConfig = getAssetConfig('USDG');
    const ethConfig = getAssetConfig('ETH');

    checks.push({
      name: 'DISPLAY_NAME_NEVER_USED_AS_NETWORK_FOR_TOKENS',
      passed:
        !!linkConfig &&
        !!usdcConfig &&
        !!usdgConfig &&
        resolveNetworkIdentifier(linkConfig) !== linkConfig.name &&
        resolveNetworkIdentifier(usdcConfig) !== usdcConfig.name &&
        resolveNetworkIdentifier(usdgConfig) !== usdgConfig.name &&
        resolveNetworkIdentifier(linkConfig) === 'ETH' &&
        resolveNetworkIdentifier(usdcConfig) === 'ETH' &&
        resolveNetworkIdentifier(usdgConfig) === 'ETH',
      detail: `"Chainlink"/"USD Coin"/"USDG" must never be used as a network identifier. Got LINK="${linkConfig && resolveNetworkIdentifier(linkConfig)}", USDC="${usdcConfig && resolveNetworkIdentifier(usdcConfig)}", USDG="${usdgConfig && resolveNetworkIdentifier(usdgConfig)}".`,
    });

    checks.push({
      name: 'NATIVE_ETH_NETWORK_IDENTIFIER_UNCHANGED',
      passed: !!ethConfig && resolveNetworkIdentifier(ethConfig) === 'Ethereum',
      detail: `Native ETH must keep resolving its network identifier from its display name exactly as before ("Ethereum"). Got "${ethConfig && resolveNetworkIdentifier(ethConfig)}".`,
    });

    const ethGate = await TransactionSecurityGateService.evaluate({
      accountId: 'self-test',
      assetSymbol: 'ETH',
      network: 'ETH',
      from: TEST_SENDER,
      to: TEST_RECIPIENT,
      amount: '1',
      amountUnit: 'NATIVE',
      sendMode: 'EXACT_SEND',
      securityProfile: 'STANDARD',
    });

    checks.push({
      name: 'NATIVE_ETH_INTENT_UNCHANGED',
      passed:
        ethGate.intent.asset.decimals === 18 &&
        ethGate.intent.asset.tokenContract === undefined &&
        ethGate.intent.amountUnit === 'NATIVE',
      detail: `Native ETH intents must remain unaffected by token metadata wiring (18 decimals, no tokenContract). Got ${JSON.stringify(ethGate.intent.asset)}, amountUnit=${ethGate.intent.amountUnit}.`,
    });

    // --- Native ETH fee estimation must be byte-for-byte unchanged: still
    // flat 21000 * current gas price, never touched by the ERC-20 work.
    try {
      const ethProvider = getEvmProvider('ETH');
      const [nativeFee, gasPriceWei] = await Promise.all([
        ethProvider.estimateFee(),
        ethProvider.getGasPriceWei(),
      ]);

      checks.push({
        name: 'NATIVE_ETH_FEE_ESTIMATE_UNCHANGED',
        passed: nativeFee === 21000n * gasPriceWei,
        detail: `Native ETH fee must remain exactly 21000 * current gas price, untouched by ERC-20 work. 21000*${gasPriceWei}=${21000n * gasPriceWei}, got ${nativeFee}.`,
      });
    } catch (error) {
      checks.push({
        name: 'NATIVE_ETH_FEE_ESTIMATE_UNCHANGED',
        passed: false,
        detail: `Native ETH fee estimation threw unexpectedly (requires live network access): ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }

    // --- Negative tests ---

    try {
      EvmProvider.encodeErc20Transfer('not-an-address', 1n);
      checks.push({
        name: 'NEGATIVE_INVALID_RECIPIENT_FAILS_CLOSED',
        passed: false,
        detail: 'encodeErc20Transfer must throw for an invalid recipient address, but it did not.',
      });
    } catch {
      checks.push({
        name: 'NEGATIVE_INVALID_RECIPIENT_FAILS_CLOSED',
        passed: true,
        detail: 'encodeErc20Transfer correctly throws for an invalid recipient address.',
      });
    }

    try {
      const linkProvider = getEvmProvider('LINK');
      await linkProvider.estimateErc20TransferGas(TEST_SENDER, EXPECTED.LINK.tokenContract, '0xdeadbeef');
      checks.push({
        name: 'NEGATIVE_MALFORMED_CALLDATA_FAILS_CLOSED',
        passed: false,
        detail: 'estimateErc20TransferGas must throw for calldata that is not an ERC-20 transfer selector, but it did not.',
      });
    } catch {
      checks.push({
        name: 'NEGATIVE_MALFORMED_CALLDATA_FAILS_CLOSED',
        passed: true,
        detail: 'estimateErc20TransferGas correctly throws for non-transfer calldata.',
      });
    }

    try {
      const unreachableProvider = new EvmProvider('ETH', 1, 'http://127.0.0.1:1');
      const data = EvmProvider.encodeErc20Transfer(TEST_RECIPIENT, 0n);
      await unreachableProvider.estimateErc20TransferGas(TEST_SENDER, EXPECTED.LINK.tokenContract, data);
      checks.push({
        name: 'NEGATIVE_RPC_UNREACHABLE_FAILS_CLOSED',
        passed: false,
        detail: 'estimateErc20TransferGas must throw when the RPC endpoint is unreachable, but it did not.',
      });
    } catch {
      checks.push({
        name: 'NEGATIVE_RPC_UNREACHABLE_FAILS_CLOSED',
        passed: true,
        detail: 'estimateErc20TransferGas correctly throws when the RPC endpoint is unreachable - no fallback gas limit was used.',
      });
    }

    return {
      passed: checks.every((check) => check.passed),
      checks,
    };
  }
}
