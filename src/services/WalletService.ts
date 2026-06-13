import { Buffer } from 'buffer';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { deriveAddress, deriveKeypair, generateSeed } from 'ripple-keypairs';
import { Keypair as StellarKeypair } from '@stellar/stellar-base';
import algosdk from 'algosdk';

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

  static getSeed(mnemonic: string): Uint8Array {
    return mnemonicToSeedSync(mnemonic);
  }

  static getRoot(seed: Uint8Array) {
    return HDKey.fromMasterSeed(seed);
  }

  private static derive32Bytes(mnemonic: string, label: string) {
    const seed = this.getSeed(mnemonic);
    const digest = ethers.sha256(
      Buffer.concat([Buffer.from(seed), Buffer.from(label, 'utf8')])
    );

    return Buffer.from(ethers.getBytes(digest)).subarray(0, 32);
  }

  static getEthereumWallet(mnemonic: string) {
    const wallet = ethers.Wallet.fromPhrase(mnemonic);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      path: "m/44'/60'/0'/0/0",
    };
  }

  static getBitcoinWallet(mnemonic: string) {
    const seed = this.getSeed(mnemonic);
    const root = this.getRoot(seed);
    const path = "m/84'/0'/0'/0/0";
    const child = root.derive(path);

    if (!child.publicKey || !child.privateKey) {
      throw new Error('Failed to derive BTC key');
    }

    const payment = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(child.publicKey),
      network: bitcoin.networks.bitcoin,
    });

    if (!payment.address) {
      throw new Error('Failed to create BTC address');
    }

    return {
      address: payment.address,
      privateKeyHex: Buffer.from(child.privateKey).toString('hex'),
      path,
    };
  }

  static getLitecoinWallet(mnemonic: string) {
    const seed = this.getSeed(mnemonic);
    const root = this.getRoot(seed);
    const path = "m/84'/2'/0'/0/0";
    const child = root.derive(path);

    if (!child.publicKey || !child.privateKey) {
      throw new Error('Failed to derive LTC key');
    }

    const litecoinNetwork = {
      messagePrefix: '\x19Litecoin Signed Message:\n',
      bech32: 'ltc',
      bip32: {
        public: 0x019da462,
        private: 0x019d9cfe,
      },
      pubKeyHash: 0x30,
      scriptHash: 0x32,
      wif: 0xb0,
    };

    const payment = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(child.publicKey),
      network: litecoinNetwork,
    });

    if (!payment.address) {
      throw new Error('Failed to create LTC address');
    }

    return {
      address: payment.address,
      privateKeyHex: Buffer.from(child.privateKey).toString('hex'),
      path,
    };
  }

  static getSolanaWallet(mnemonic: string) {
    const seed32 = this.derive32Bytes(mnemonic, "RON1N_SOL_m/44'/501'/0'/0'");
    const keypair = nacl.sign.keyPair.fromSeed(seed32);

    return {
      address: bs58.encode(keypair.publicKey),
      secretKey: Buffer.from(keypair.secretKey).toString('hex'),
      path: "ron1n-deterministic-sol",
    };
  }

  static getXrpWallet(mnemonic: string) {
    const seed = this.getSeed(mnemonic);
    const root = this.getRoot(seed);
    const path = "m/44'/144'/0'/0/0";
    const child = root.derive(path);

    if (!child.privateKey) {
      throw new Error('Failed to derive XRP key');
    }

    const entropy = Buffer.from(child.privateKey).subarray(0, 16);
    const familySeed = generateSeed({ entropy });
    const keypair = deriveKeypair(familySeed);
    const address = deriveAddress(keypair.publicKey);

    return {
      address,
      seed: familySeed,
      publicKey: keypair.publicKey,
      privateKey: keypair.privateKey,
      path,
    };
  }

  static getStellarWallet(mnemonic: string) {
    const seed32 = this.derive32Bytes(mnemonic, "RON1N_XLM_m/44'/148'/0'");
    const keypair = StellarKeypair.fromRawEd25519Seed(seed32);

    return {
      address: keypair.publicKey(),
      secret: keypair.secret(),
      path: 'ron1n-deterministic-xlm',
    };
  }

  static getAlgorandWallet(mnemonic: string) {
    const seed32 = this.derive32Bytes(mnemonic, "RON1N_ALGO_m/44'/283'/0'/0'/0'");
    const keypair = nacl.sign.keyPair.fromSeed(seed32);
    const address = algosdk.encodeAddress(keypair.publicKey);

    return {
      address,
      secretKeyHex: Buffer.from(keypair.secretKey).toString('hex'),
      path: 'ron1n-deterministic-algo',
    };
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