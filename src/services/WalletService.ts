import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { CryptoCore } from './crypto/CryptoCore';
import type { PublicAddressResult } from './crypto/types';

export type Ron1nEvmNetwork = {
  symbol: string;
  name: string;
  address: string;
  chainId: number;
};

export class WalletService {
  static createMnemonic(): string {
    return generateMnemonic(wordlist, 256);
  }

  static async getEthereumWallet(index: number = 0): Promise<PublicAddressResult> {
    return CryptoCore.getPublicAddress('EVM', { index });
  }

  static async getBitcoinWallet(index: number = 0): Promise<PublicAddressResult> {
    return CryptoCore.getPublicAddress('BITCOIN', { index });
  }

  static async getLitecoinWallet(index: number = 0): Promise<PublicAddressResult> {
    return CryptoCore.getPublicAddress('LITECOIN', { index });
  }

  static async getSolanaWallet(index: number = 0): Promise<PublicAddressResult> {
    return CryptoCore.getPublicAddress('SOLANA', { index });
  }

  static async getXrpWallet(index: number = 0): Promise<PublicAddressResult> {
    return CryptoCore.getPublicAddress('XRP', { index });
  }

  static async getStellarWallet(index: number = 0): Promise<PublicAddressResult> {
    return CryptoCore.getPublicAddress('STELLAR', { index });
  }

  static async getAlgorandWallet(index: number = 0): Promise<PublicAddressResult> {
    return CryptoCore.getPublicAddress('ALGORAND', { index });
  }

  static getEvmNetworks(ethAddress: string): Ron1nEvmNetwork[] {
    return [
      { symbol: 'ETH', name: 'Ethereum', address: ethAddress, chainId: 1 },
      { symbol: 'AVAX', name: 'Avalanche C-Chain', address: ethAddress, chainId: 43114 },
      { symbol: 'CRO', name: 'Cronos', address: ethAddress, chainId: 25 },
      { symbol: 'BERA', name: 'Berachain', address: ethAddress, chainId: 80094 },
      { symbol: 'BASE', name: 'Base', address: ethAddress, chainId: 8453 },
      { symbol: 'POL', name: 'Polygon', address: ethAddress, chainId: 137 },
      { symbol: 'ARB', name: 'Arbitrum', address: ethAddress, chainId: 42161 },
    ];
  }
}
