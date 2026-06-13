import { ImageSourcePropType } from 'react-native';
import { Ron1nColors } from '../theme/ron1nTheme';

export type AssetVisual = {
  symbol: string;
  logoText: string;
  logo: ImageSourcePropType;
  accent: string;
};

const VISUALS: Record<string, AssetVisual> = {
  BTC: {
    symbol: 'BTC',
    logoText: '₿',
    logo: require('../../assets/tokens/btc.png'),
    accent: '#F7931A',
  },
  LTC: {
    symbol: 'LTC',
    logoText: 'Ł',
    logo: require('../../assets/tokens/ltc.png'),
    accent: '#BEBEBE',
  },
  ETH: {
    symbol: 'ETH',
    logoText: 'Ξ',
    logo: require('../../assets/tokens/eth.png'),
    accent: Ron1nColors.blue,
  },
  SOL: {
    symbol: 'SOL',
    logoText: 'S',
    logo: require('../../assets/tokens/sol.png'),
    accent: Ron1nColors.purple,
  },
  XRP: {
    symbol: 'XRP',
    logoText: 'X',
    logo: require('../../assets/tokens/xrp.png'),
    accent: Ron1nColors.blue,
  },
  XLM: {
    symbol: 'XLM',
    logoText: '★',
    logo: require('../../assets/tokens/xlm.png'),
    accent: Ron1nColors.green,
  },
  ALGO: {
    symbol: 'ALGO',
    logoText: 'A',
    logo: require('../../assets/tokens/algo.png'),
    accent: Ron1nColors.gold,
  },

  AVAX: {
    symbol: 'AVAX',
    logoText: 'A',
    logo: require('../../assets/tokens/avax.png'),
    accent: '#E84142',
  },
  CRO: {
    symbol: 'CRO',
    logoText: 'C',
    logo: require('../../assets/tokens/cro.png'),
    accent: '#103F68',
  },
  BERA: {
    symbol: 'BERA',
    logoText: 'B',
    logo: require('../../assets/tokens/bera.png'),
    accent: '#F5B642',
  },
  BASE: {
    symbol: 'BASE',
    logoText: 'B',
    logo: require('../../assets/tokens/base.png'),
    accent: Ron1nColors.blue,
  },
  POL: {
    symbol: 'POL',
    logoText: 'P',
    logo: require('../../assets/tokens/pol.png'),
    accent: Ron1nColors.purple,
  },
  ARB: {
    symbol: 'ARB',
    logoText: 'A',
    logo: require('../../assets/tokens/arb.png'),
    accent: Ron1nColors.blue,
  },

  LINK: {
    symbol: 'LINK',
    logoText: 'L',
    logo: require('../../assets/tokens/link.png'),
    accent: Ron1nColors.purple,
  },
  USDC: {
    symbol: 'USDC',
    logoText: '$',
    logo: require('../../assets/tokens/usdc.png'),
    accent: Ron1nColors.blue,
  },
  USDG: {
    symbol: 'USDG',
    logoText: '$',
    logo: require('../../assets/tokens/usdg.png'),
    accent: Ron1nColors.gold,
  },
};

export function getAssetVisual(symbol: string): AssetVisual {
  const normalized = symbol.toUpperCase();

  return (
    VISUALS[normalized] ?? {
      symbol: normalized,
      logoText: normalized.slice(0, 1),
      logo: require('../../assets/icon.png'),
      accent: Ron1nColors.green,
    }
  );
}