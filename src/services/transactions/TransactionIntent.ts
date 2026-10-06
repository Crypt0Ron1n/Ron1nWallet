import type { SupportedChain } from '../crypto/types';
import type { SendMode } from '../fees/types';

export type SecurityProfile = 'STANDARD' | 'PROTECTED' | 'MAXIMUM';

export type TransactionIntentAsset = {
  symbol: string;
  chain: SupportedChain;
  network: string;
  chainId?: number;
  decimals?: number;
  tokenContract?: string;
};

export type TransactionIntent = {
  intentId: string;
  accountId: string;
  asset: TransactionIntentAsset;
  from: string;
  to: string;

  /** Exact quantity of the selected blockchain asset, never a fiat value. */
  amount: string;
  amountUnit: 'NATIVE' | 'TOKEN';

  /** Optional fiat-only display value. Never used as the blockchain amount. */
  fiatAmountUsd?: string;

  sendMode: SendMode;
  securityProfile: SecurityProfile;
  createdAt: number;
  memo?: string;
  metadata?: Readonly<Record<string, string>>;
};

export type TransactionIntentValidationCode =
  | 'MISSING_INTENT_ID'
  | 'MISSING_ACCOUNT_ID'
  | 'UNSUPPORTED_ASSET'
  | 'MISSING_FROM'
  | 'MISSING_RECIPIENT'
  | 'MISSING_AMOUNT'
  | 'INVALID_AMOUNT'
  | 'INVALID_FIAT_AMOUNT'
  | 'INVALID_CHAIN'
  | 'INVALID_AMOUNT_UNIT'
  | 'INVALID_DECIMALS'
  | 'SECRET_MATERIAL_PRESENT'
  | 'INVALID_MEMO'
  | 'INVALID_TIMESTAMP';

export type TransactionIntentValidationResult = {
  valid: boolean;
  codes: TransactionIntentValidationCode[];
};

const SUPPORTED_CHAINS: ReadonlySet<SupportedChain> = new Set([
  'EVM',
  'SOLANA',
  'BITCOIN',
  'LITECOIN',
  'XRP',
  'STELLAR',
  'ALGORAND',
]);

function containsSecretMaterial(value: unknown): boolean {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return (
      normalized.includes('private key') ||
      normalized.includes('privatekey') ||
      normalized.includes('mnemonic') ||
      normalized.includes('seed phrase') ||
      normalized.includes('seedphrase') ||
      normalized.includes('secret key') ||
      normalized.includes('secretkey')
    );
  }

  if (Array.isArray(value)) return value.some(containsSecretMaterial);

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, child]) => containsSecretMaterial(key) || containsSecretMaterial(child)
    );
  }

  return false;
}

/**
 * Exact decimal syntax validation.
 * This intentionally avoids Number() so large blockchain quantities do not
 * lose precision before they reach a base-unit conversion layer.
 */
function isPositiveDecimal(value: string): boolean {
  const normalized = value.trim();

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) return false;

  const [whole, fraction = ''] = normalized.split('.');
  const significant = `${whole}${fraction}`.replace(/^0+/, '');

  return significant.length > 0 && BigInt(significant) > 0n;
}

function isValidOptionalFiatAmount(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') return true;

  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return false;

  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(`${whole}${fraction.padEnd(2, '0')}`) >= 0n;
}

export function validateTransactionIntent(
  intent: TransactionIntent
): TransactionIntentValidationResult {
  const codes: TransactionIntentValidationCode[] = [];

  if (!intent.intentId?.trim()) codes.push('MISSING_INTENT_ID');
  if (!intent.accountId?.trim()) codes.push('MISSING_ACCOUNT_ID');

  if (
    !intent.asset?.symbol?.trim() ||
    !intent.asset?.network?.trim() ||
    !SUPPORTED_CHAINS.has(intent.asset?.chain)
  ) {
    codes.push('UNSUPPORTED_ASSET');
  }

  if (!intent.from?.trim()) codes.push('MISSING_FROM');
  if (!intent.to?.trim()) codes.push('MISSING_RECIPIENT');

  if (!intent.amount?.trim()) {
    codes.push('MISSING_AMOUNT');
  } else if (!isPositiveDecimal(intent.amount)) {
    codes.push('INVALID_AMOUNT');
  }

  if (intent.amountUnit !== 'NATIVE' && intent.amountUnit !== 'TOKEN') {
    codes.push('INVALID_AMOUNT_UNIT');
  }

  if (
    intent.asset?.decimals !== undefined &&
    (!Number.isInteger(intent.asset.decimals) ||
      intent.asset.decimals < 0 ||
      intent.asset.decimals > 255)
  ) {
    codes.push('INVALID_DECIMALS');
  }

  if (!SUPPORTED_CHAINS.has(intent.asset?.chain)) {
    codes.push('INVALID_CHAIN');
  }

  if (!isValidOptionalFiatAmount(intent.fiatAmountUsd)) {
    codes.push('INVALID_FIAT_AMOUNT');
  }

  if (intent.memo !== undefined && intent.memo.length > 512) {
    codes.push('INVALID_MEMO');
  }

  if (!Number.isFinite(intent.createdAt) || intent.createdAt <= 0) {
    codes.push('INVALID_TIMESTAMP');
  }

  if (containsSecretMaterial(intent)) {
    codes.push('SECRET_MATERIAL_PRESENT');
  }

  return {
    valid: codes.length === 0,
    codes: [...new Set(codes)],
  };
}

export function createTransactionIntentId(): string {
  return `intent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
