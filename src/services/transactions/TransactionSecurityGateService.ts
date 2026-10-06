import { RON1N_ASSETS } from '../../config/assetCatalog';
import { ProviderFactory } from '../providers/ProviderFactory';
import type { ChainProviderStatus } from '../providers/types';
import {
  SecurityPolicyEngine,
  type SecurityPolicyCapabilities,
  type SecurityPolicyResult,
} from '../SecurityPolicyEngine';
import {
  createTransactionIntentId,
  validateTransactionIntent,
  type SecurityProfile,
  type TransactionIntent,
  type TransactionIntentAsset,
  type TransactionIntentValidationResult,
} from './TransactionIntent';

export type TransactionSecurityGateRequest = {
  accountId: string;
  assetSymbol: string;
  network: string;
  from: string;
  to: string;
  amount: string;
  amountUnit: 'NATIVE' | 'TOKEN';
  fiatAmountUsd?: string;
  sendMode: 'EXACT_SEND' | 'SPEND_TOTAL';
  securityProfile: SecurityProfile;
  chainId?: number;
  memo?: string;
};

export type TransactionSecurityGateResult = {
  intent: TransactionIntent;
  validation: TransactionIntentValidationResult;
  policy: SecurityPolicyResult;
  providerStatus: ChainProviderStatus;
  broadcastSupported: boolean;
  canProceedToReview: boolean;
};

function supportedChainForSymbol(
  symbol: string
): TransactionIntentAsset['chain'] | null {
  const asset = RON1N_ASSETS.find(
    (candidate) => candidate.symbol.toUpperCase() === symbol.toUpperCase()
  );

  if (!asset) return null;

  switch (asset.family) {
    case 'EVM':
      return 'EVM';

    case 'UTXO':
      return asset.symbol.toUpperCase() === 'LTC'
        ? 'LITECOIN'
        : 'BITCOIN';

    case 'SOLANA':
      return 'SOLANA';

    case 'XRP':
      return 'XRP';

    case 'STELLAR':
      return 'STELLAR';

    case 'ALGORAND':
      return 'ALGORAND';

    case 'TOKEN':
      return asset.baseChainSymbol
        ? supportedChainForSymbol(asset.baseChainSymbol)
        : null;

    default:
      return null;
  }
}

function nativeDecimalsForSymbol(symbol: string): number | undefined {
  switch (symbol.toUpperCase()) {
    case 'BTC':
    case 'LTC':
      return 8;

    case 'ETH':
      return 18;

    case 'SOL':
      return 9;

    case 'XRP':
      return 6;

    case 'XLM':
      return 7;

    case 'ALGO':
      return 6;

    default:
      return undefined;
  }
}

function buildIntentAsset(
  request: TransactionSecurityGateRequest
): TransactionIntentAsset {
  const symbol = request.assetSymbol.trim().toUpperCase();

  const catalogAsset = RON1N_ASSETS.find(
    (candidate) => candidate.symbol.toUpperCase() === symbol
  );

  const chain = supportedChainForSymbol(symbol) ?? 'EVM';
  const isToken = catalogAsset?.family === 'TOKEN';

  return {
    symbol,
    chain,
    network: request.network.trim(),

    ...(request.chainId !== undefined
      ? { chainId: request.chainId }
      : catalogAsset?.chainId !== undefined
        ? { chainId: catalogAsset.chainId }
        : {}),

    ...(!isToken
      ? (() => {
          const decimals = nativeDecimalsForSymbol(symbol);

          return decimals !== undefined
            ? { decimals }
            : {};
        })()
      : {}),
  };
}

export class TransactionSecurityGateService {
  static async evaluate(
    request: TransactionSecurityGateRequest
  ): Promise<TransactionSecurityGateResult> {
    const assetSymbol = request.assetSymbol.trim().toUpperCase();

    const catalogAsset = RON1N_ASSETS.find(
      (candidate) => candidate.symbol.toUpperCase() === assetSymbol
    );

    const amountUnit =
      catalogAsset?.family === 'TOKEN'
        ? 'TOKEN'
        : request.amountUnit;

    /*
     * Fiat is display/review metadata only.
     *
     * It must never invalidate an otherwise valid blockchain transaction.
     * The canonical transaction quantity is `amount` in the selected
     * asset's native/token unit.
     */
    const intent: TransactionIntent = {
      intentId: createTransactionIntentId(),
      accountId: request.accountId.trim(),
      asset: buildIntentAsset(request),
      from: request.from.trim(),
      to: request.to.trim(),
      amount: request.amount.trim(),
      amountUnit,
      sendMode: request.sendMode,
      securityProfile: request.securityProfile,
      createdAt: Date.now(),

      ...(request.memo !== undefined
        ? { memo: request.memo }
        : {}),
    };

    const validation = validateTransactionIntent(intent);

    const provider = ProviderFactory.getProvider(
      intent.asset.symbol
    );

    const providerStatus = await provider.getStatus();

    const capabilities: SecurityPolicyCapabilities = {
      broadcastSupported:
        catalogAsset?.supportsBroadcast === true,

      providerConnected:
        providerStatus.connected,

      providerMode:
        providerStatus.mode,
    };

    const policy = SecurityPolicyEngine.evaluate(
      intent,
      null,
      capabilities
    );

    return {
      intent,
      validation,
      policy,
      providerStatus,
      broadcastSupported:
        capabilities.broadcastSupported,
      canProceedToReview:
        validation.valid &&
        policy.decision !== 'BLOCK',
    };
  }
}
