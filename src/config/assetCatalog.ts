export type Ron1nAssetCategory = 'Native' | 'EVM' | 'Token' | 'Future';

export type Ron1nAssetFamily =
  | 'EVM'
  | 'UTXO'
  | 'SOLANA'
  | 'XRP'
  | 'STELLAR'
  | 'ALGORAND'
  | 'HEDERA'
  | 'SUI'
  | 'CARDANO'
  | 'ICP'
  | 'ZCASH'
  | 'MONERO'
  | 'TOKEN'
  | 'UNKNOWN';

export type Ron1nAssetConfig = {
  symbol: string;
  name: string;
  category: Ron1nAssetCategory;
  family: Ron1nAssetFamily;
  chainId?: number;
  baseChainSymbol?: string;
  enabledInWallet: boolean;
  enabledInSendReview: boolean;
  supportsReceive: boolean;
  supportsBalance: boolean;
  supportsHistory: boolean;
  supportsExposureScan: boolean;
  supportsBroadcast: boolean;
  securityLabel: string;
};

export const RON1N_ASSETS: Ron1nAssetConfig[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    category: 'Native',
    family: 'UTXO',
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Address hygiene ready',
  },
  {
    symbol: 'LTC',
    name: 'Litecoin',
    category: 'Native',
    family: 'UTXO',
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Address hygiene ready',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    category: 'Native',
    family: 'EVM',
    chainId: 1,
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'EVM security layer ready',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    category: 'Native',
    family: 'SOLANA',
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Activity monitoring ready',
  },
  {
    symbol: 'XRP',
    name: 'XRP Ledger',
    category: 'Native',
    family: 'XRP',
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Account monitoring ready',
  },
  {
    symbol: 'XLM',
    name: 'Stellar',
    category: 'Native',
    family: 'STELLAR',
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Account monitoring ready',
  },
  {
    symbol: 'ALGO',
    name: 'Algorand',
    category: 'Native',
    family: 'ALGORAND',
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Account monitoring ready',
  },

  {
    symbol: 'AVAX',
    name: 'Avalanche C-Chain',
    category: 'EVM',
    family: 'EVM',
    chainId: 43114,
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Uses EVM address',
  },
  {
    symbol: 'CRO',
    name: 'Cronos',
    category: 'EVM',
    family: 'EVM',
    chainId: 25,
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Uses EVM address',
  },
  {
    symbol: 'BERA',
    name: 'Berachain',
    category: 'EVM',
    family: 'EVM',
    chainId: 80094,
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Uses EVM address',
  },
  {
    symbol: 'BASE',
    name: 'Base',
    category: 'EVM',
    family: 'EVM',
    chainId: 8453,
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Uses EVM address',
  },
  {
    symbol: 'POL',
    name: 'Polygon',
    category: 'EVM',
    family: 'EVM',
    chainId: 137,
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Uses EVM address',
  },
  {
    symbol: 'ARB',
    name: 'Arbitrum',
    category: 'EVM',
    family: 'EVM',
    chainId: 42161,
    enabledInWallet: true,
    enabledInSendReview: true,
    supportsReceive: true,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: true,
    supportsBroadcast: false,
    securityLabel: 'Uses EVM address',
  },

  {
    symbol: 'LINK',
    name: 'Chainlink',
    category: 'Token',
    family: 'TOKEN',
    baseChainSymbol: 'ETH',
    enabledInWallet: false,
    enabledInSendReview: true,
    supportsReceive: false,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: false,
    supportsBroadcast: false,
    securityLabel: 'Token display architecture',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    category: 'Token',
    family: 'TOKEN',
    baseChainSymbol: 'ETH',
    enabledInWallet: false,
    enabledInSendReview: true,
    supportsReceive: false,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: false,
    supportsBroadcast: false,
    securityLabel: 'Token display architecture',
  },
  {
    symbol: 'USDG',
    name: 'USDG',
    category: 'Token',
    family: 'TOKEN',
    baseChainSymbol: 'ETH',
    enabledInWallet: false,
    enabledInSendReview: true,
    supportsReceive: false,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: false,
    supportsBroadcast: false,
    securityLabel: 'Token display architecture',
  },

  {
    symbol: 'HBAR',
    name: 'Hedera',
    category: 'Future',
    family: 'HEDERA',
    enabledInWallet: false,
    enabledInSendReview: false,
    supportsReceive: false,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: false,
    supportsBroadcast: false,
    securityLabel: 'Future native support',
  },
  {
    symbol: 'SUI',
    name: 'Sui',
    category: 'Future',
    family: 'SUI',
    enabledInWallet: false,
    enabledInSendReview: false,
    supportsReceive: false,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: false,
    supportsBroadcast: false,
    securityLabel: 'Future native support',
  },
  {
    symbol: 'ADA',
    name: 'Cardano',
    category: 'Future',
    family: 'CARDANO',
    enabledInWallet: false,
    enabledInSendReview: false,
    supportsReceive: false,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: false,
    supportsBroadcast: false,
    securityLabel: 'Future native support',
  },
  {
    symbol: 'ICP',
    name: 'Internet Computer',
    category: 'Future',
    family: 'ICP',
    enabledInWallet: false,
    enabledInSendReview: false,
    supportsReceive: false,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: false,
    supportsBroadcast: false,
    securityLabel: 'Future native support',
  },
  {
    symbol: 'ZEC',
    name: 'Zcash',
    category: 'Future',
    family: 'ZCASH',
    enabledInWallet: false,
    enabledInSendReview: false,
    supportsReceive: false,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: false,
    supportsBroadcast: false,
    securityLabel: 'Future privacy asset support',
  },
  {
    symbol: 'XMR',
    name: 'Monero',
    category: 'Future',
    family: 'MONERO',
    enabledInWallet: false,
    enabledInSendReview: false,
    supportsReceive: false,
    supportsBalance: false,
    supportsHistory: false,
    supportsExposureScan: false,
    supportsBroadcast: false,
    securityLabel: 'Future privacy asset support',
  },
];

export const WALLET_ASSETS = RON1N_ASSETS.filter((asset) => asset.enabledInWallet);
export const SEND_REVIEW_ASSETS = RON1N_ASSETS.filter(
  (asset) => asset.enabledInSendReview
);

export function getAssetConfig(symbol: string) {
  return RON1N_ASSETS.find(
    (asset) => asset.symbol.toUpperCase() === symbol.toUpperCase()
  );
}

export function getAssetsByCategory(category: Ron1nAssetCategory) {
  return RON1N_ASSETS.filter((asset) => asset.category === category);
}