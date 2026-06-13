import { ChainProvider } from './types';
import { EvmProvider } from './EvmProvider';
import { UtxoProvider } from './UtxoProvider';
import { SolanaProvider } from './SolanaProvider';
import { XrpProvider } from './XrpProvider';
import { StellarProvider } from './StellarProvider';
import { AlgorandProvider } from './AlgorandProvider';
import { BaseMockProvider } from './BaseMockProvider';

export type SupportedProviderAsset =
  | 'BTC'
  | 'LTC'
  | 'ETH'
  | 'SOL'
  | 'XRP'
  | 'XLM'
  | 'ALGO'
  | 'AVAX'
  | 'CRO'
  | 'BERA'
  | 'BASE'
  | 'POL'
  | 'ARB'
  | 'LINK'
  | 'USDC'
  | 'USDG';

const EVM_NETWORKS: Record<string, { chain: string; chainId: number }> = {
  ETH: { chain: 'ETH', chainId: 1 },
  AVAX: { chain: 'AVAX', chainId: 43114 },
  CRO: { chain: 'CRO', chainId: 25 },
  BERA: { chain: 'BERA', chainId: 80094 },
  BASE: { chain: 'BASE', chainId: 8453 },
  POL: { chain: 'POL', chainId: 137 },
  ARB: { chain: 'ARB', chainId: 42161 },
  LINK: { chain: 'ETH', chainId: 1 },
  USDC: { chain: 'ETH', chainId: 1 },
  USDG: { chain: 'ETH', chainId: 1 },
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

    if (EVM_NETWORKS[normalized]) {
      const evm = EVM_NETWORKS[normalized];
      return new EvmProvider(evm.chain, evm.chainId);
    }

    return new BaseMockProvider(normalized, 'UNKNOWN');
  }

  static isEvmAsset(asset: string) {
    return Boolean(EVM_NETWORKS[asset.toUpperCase()]);
  }

  static getSupportedAssets(): SupportedProviderAsset[] {
    return [
      'BTC',
      'LTC',
      'ETH',
      'SOL',
      'XRP',
      'XLM',
      'ALGO',
      'AVAX',
      'CRO',
      'BERA',
      'BASE',
      'POL',
      'ARB',
      'LINK',
      'USDC',
      'USDG',
    ];
  }
}