import { RON1N_ASSETS } from '../../config/assetCatalog';
import { ChainProvider } from './types';
import { EvmProvider } from './EvmProvider';
import { UtxoProvider } from './UtxoProvider';
import { SolanaProvider } from './SolanaProvider';
import { XrpProvider } from './XrpProvider';
import { StellarProvider } from './StellarProvider';
import { AlgorandProvider } from './AlgorandProvider';
import { BaseMockProvider } from './BaseMockProvider';

const EVM_CHAIN_IDS: Record<string, number> = {
  ETH: 1,
  AVAX: 43114,
  CRO: 25,
  BERA: 80094,
  BASE: 8453,
  POL: 137,
  ARB: 42161,
};

export class ProviderFactory {
  static getProvider(asset: string): ChainProvider {
    const normalized = asset.toUpperCase();

    if (normalized === 'BTC') return new UtxoProvider('BTC');
    if (normalized === 'LTC') return new UtxoProvider('LTC');
    if (normalized === 'SOL') return new SolanaProvider();
    if (normalized === 'XRP') return new XrpProvider();
    if (normalized === 'XLM') return new StellarProvider();
    if (normalized === 'ALGO') return new AlgorandProvider();

    if (EVM_CHAIN_IDS[normalized]) {
      return new EvmProvider(normalized, EVM_CHAIN_IDS[normalized]);
    }

    if (normalized === 'LINK' || normalized === 'USDC' || normalized === 'USDG') {
      return new EvmProvider('ETH', 1);
    }

    return new BaseMockProvider(normalized, 'UNKNOWN');
  }

  static isEvmAsset(asset: string) {
    const normalized = asset.toUpperCase();
    return Boolean(EVM_CHAIN_IDS[normalized]) || ['LINK', 'USDC', 'USDG'].includes(normalized);
  }

  static getSupportedAssets(): string[] {
    return RON1N_ASSETS.map((asset) => asset.symbol);
  }

  static getSendReviewAssets(): string[] {
    return RON1N_ASSETS.filter((asset) => asset.enabledInSendReview).map(
      (asset) => asset.symbol
    );
  }

  static getWalletAssets(): string[] {
    return RON1N_ASSETS.filter((asset) => asset.enabledInWallet).map(
      (asset) => asset.symbol
    );
  }
}