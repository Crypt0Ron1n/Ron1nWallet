import { Buffer } from 'buffer';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

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
    const seed = this.getSeed(mnemonic);
    const seed32 = seed.slice(0, 32);

    const keypair = nacl.sign.keyPair.fromSeed(seed32);

    return {
      address: bs58.encode(keypair.publicKey),
      secretKey: Buffer.from(keypair.secretKey).toString('hex'),
      path: 'ed25519-seed',
    };
  }
}