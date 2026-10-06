import type { Network } from 'bitcoinjs-lib';

/** Litecoin mainnet params for bitcoinjs-lib (not bundled with the library itself). */
export const litecoinNetwork: Network = {
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
