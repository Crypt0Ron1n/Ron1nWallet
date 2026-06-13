import { Ron1nColors } from '../theme/ron1nTheme';

export type AssetVisual = {
  symbol: string;
  logoText: string;
  accent: string;
};

const VISUALS: Record<string, AssetVisual> = {
  BTC: { symbol: 'BTC', logoText: '₿', accent: '#F7931A' },
  LTC: { symbol: 'LTC', logoText: 'Ł', accent: '#BEBEBE' },
  ETH: { symbol: 'ETH', logoText: 'Ξ', accent: Ron1nColors.blue },
  SOL: { symbol: 'SOL', logoText: 'S', accent: Ron1nColors.purple },
  XRP: { symbol: 'XRP', logoText: 'X', accent: Ron1nColors.blue },
  XLM: { symbol: 'XLM', logoText: '★', accent: Ron1nColors.green },
  ALGO: { symbol: 'ALGO', logoText: 'A', accent: Ron1nColors.gold },

  AVAX: { symbol: 'AVAX', logoText: 'A', accent: '#E84142' },
  CRO: { symbol: 'CRO', logoText: 'C', accent: '#103F68' },
  BERA: { symbol: 'BERA', logoText: 'B', accent: '#F5B642' },
  BASE: { symbol: 'BASE', logoText: 'B', accent: Ron1nColors.blue },
  POL: { symbol: 'POL', logoText: 'P', accent: Ron1nColors.purple },
  ARB: { symbol: 'ARB', logoText: 'A', accent: Ron1nColors.blue },

  LINK: { symbol: 'LINK', logoText: 'L', accent: Ron1nColors.purple },
  USDC: { symbol: 'USDC', logoText: '$', accent: Ron1nColors.blue },
  USDG: { symbol: 'USDG', logoText: '$', accent: Ron1nColors.gold },
};

export function getAssetVisual(symbol: string): AssetVisual {
  return (
    VISUALS[symbol.toUpperCase()] ?? {
      symbol,
      logoText: symbol.slice(0, 1).toUpperCase(),
      accent: Ron1nColors.green,
    }
  );
}