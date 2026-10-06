import { WalletService } from '../WalletService';
import type { PublicAddressResult, SupportedChain } from '../crypto/types';
import { IdentityRegistryService, type ShogunIdentityRecord } from './IdentityRegistryService';

export type ReceiveIdentityResult = {
  identity: ShogunIdentityRecord;
  address: PublicAddressResult;
};

/**
 * Creates/records an ingress identity without exposing secret key material.
 *
 * Address generation remains inside CryptoCore/WalletService. The identity
 * registry only receives public metadata and lifecycle information.
 */
export class ReceiveIdentityService {
  static async getOrCreateIngressIdentity(
    accountId: string,
    chain: SupportedChain,
    index = 0
  ): Promise<ReceiveIdentityResult> {
    if (!accountId.trim()) {
      throw new Error('Receive identity requires an account ID.');
    }

    if (!Number.isSafeInteger(index) || index < 0) {
      throw new Error('Receive identity requires a valid derivation index.');
    }

    const address = await this.getPublicAddress(chain, index);

    const existing = await IdentityRegistryService.list(accountId, chain);
    const matching = existing.find(
      (identity) =>
        identity.purpose === 'INGRESS' &&
        identity.index === index &&
        identity.address.toLowerCase() === address.address.toLowerCase()
    );

    if (matching) {
      if (matching.lifecycle === 'RESERVED') {
        const activated = await IdentityRegistryService.activate(
          matching.identityId
        );
        if (activated) {
          return { identity: activated, address };
        }
      }

      return { identity: matching, address };
    }

    const identity = await IdentityRegistryService.reserve({
      accountId,
      chain,
      purpose: 'INGRESS',
      index,
      address: address.address,
    });

    const activated = await IdentityRegistryService.activate(identity.identityId);

    if (!activated) {
      throw new Error('Failed to activate the receive identity.');
    }

    return {
      identity: activated,
      address,
    };
  }

  private static async getPublicAddress(
    chain: SupportedChain,
    index: number
  ): Promise<PublicAddressResult> {
    switch (chain) {
      case 'EVM':
        return WalletService.getEthereumWallet(index);
      case 'BITCOIN':
        return WalletService.getBitcoinWallet(index);
      case 'LITECOIN':
        return WalletService.getLitecoinWallet(index);
      case 'SOLANA':
        return WalletService.getSolanaWallet(index);
      case 'XRP':
        return WalletService.getXrpWallet(index);
      case 'STELLAR':
        return WalletService.getStellarWallet(index);
      case 'ALGORAND':
        return WalletService.getAlgorandWallet(index);
      default:
        throw new Error(`Unsupported receive chain: ${chain}`);
    }
  }
}
