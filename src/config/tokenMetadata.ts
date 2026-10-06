export type TokenMetadataEntry = {
  readonly tokenContract: string;
  readonly decimals: number;
  readonly chain: 'EVM';
  readonly network: 'ETH';
};

/**
 * Static, trusted ERC-20 metadata for the TOKEN-family assets already
 * present in assetCatalog.ts (LINK, USDC, USDG).
 *
 * These values are hardcoded deliberately - never fetched from an RPC,
 * token-list service, or any other runtime/external source. A contract
 * address feeding a transfer() call that moves real funds is a trust
 * boundary; this file is the only place that boundary is allowed to be
 * crossed, and only with values verified against each issuer's own
 * documentation plus a live contract read, not from memory:
 *
 * LINK - https://docs.chain.link/resources/link-token-contracts (Chainlink's own docs)
 * USDC - https://developers.circle.com/stablecoins/usdc-contract-addresses (Circle's own docs)
 * USDG - https://docs.paxos.com/guides/stablecoin/usdg/mainnet (Paxos's own docs)
 * Decimals for USDC/USDG cross-checked directly against each contract's
 * on-chain decimals() value via Etherscan.
 *
 * Do not add entries here from any other source. Do not add runtime lookup.
 */
const TOKEN_METADATA: Readonly<Record<string, TokenMetadataEntry>> = Object.freeze({
  LINK: Object.freeze({
    tokenContract: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    decimals: 18,
    chain: 'EVM',
    network: 'ETH',
  }),
  USDC: Object.freeze({
    tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    chain: 'EVM',
    network: 'ETH',
  }),
  USDG: Object.freeze({
    tokenContract: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D',
    decimals: 6,
    chain: 'EVM',
    network: 'ETH',
  }),
});

/** Returns null (never throws) so callers decide how to fail closed. */
export function getTokenMetadata(symbol: string): TokenMetadataEntry | null {
  return TOKEN_METADATA[symbol.trim().toUpperCase()] ?? null;
}
