import type { NetworkState } from '../network/types';
import type { TransactionIntent } from '../transactions/TransactionIntent';

export type SupportedChain =
  | 'EVM'
  | 'SOLANA'
  | 'BITCOIN'
  | 'LITECOIN'
  | 'XRP'
  | 'STELLAR'
  | 'ALGORAND';

export type PolicyDecision =
  | 'ALLOW'
  | 'RECOMMEND_ROTATION'
  | 'REQUIRE_ROTATION'
  | 'BLOCK';

export interface SigningAuthorization {
  intentId: string;
  accountId: string;
  policyDecision: PolicyDecision;
  policyVersion: string;
  authorizedAt: number;
  authorizationId: string;

  /**
   * SHA-256 digest of the exact intent + unsigned draft + network state
   * presented for authorization.
   */
  transactionDigest: string;
}

export interface RecoveryAuthorization {
  authorizationId: string;
  authorizedAt: number;
  method: 'BIOMETRIC';
  purpose: 'RECOVERY_EXPORT';
}

export interface DerivationReference {
  index: number;
  path?: string;
}

export type PublicAddressResult = {
  address: string;
  path: string;
  derivationStatus: 'VERIFIED' | 'LEGACY_UNVERIFIED';
};

export type ChainUnsignedTransaction =
  | { chain: 'EVM'; payload: Readonly<Record<string, unknown>> }
  | { chain: 'SOLANA'; payload: Uint8Array }
  | { chain: 'BITCOIN'; payload: string }
  | { chain: 'LITECOIN'; payload: string }
  | { chain: 'XRP'; payload: Record<string, unknown> }
  | { chain: 'STELLAR'; payload: string }
  | { chain: 'ALGORAND'; payload: Uint8Array };

export type SignedPayload =
  | {
      chain: 'EVM';
      kind: 'RAW_TRANSACTION';
      rawTransaction: string;
      transactionDigest: string;
    }
  | {
      chain: 'BITCOIN' | 'LITECOIN';
      kind: 'RAW_TRANSACTION';
      rawTransaction: string;
      transactionDigest: string;
    }
  | {
      chain: 'SOLANA' | 'XRP' | 'STELLAR' | 'ALGORAND';
      kind: 'SIGNED_PAYLOAD';
      payload: string;
      transactionDigest: string;
    };

export interface SigningEnvelope {
  intent: TransactionIntent;
  draft: {
    draftVersion: string;
    kind: string;
    chain: SupportedChain;
    asset: string;
    accountId: string;
    intentId: string;
    from: string;
    to: string;
    amount: string;
    amountUnit: 'NATIVE' | 'TOKEN';
    amountBaseUnits?: string;
    network: string;
    chainId?: number;
    memo?: string;
    payload: Readonly<Record<string, unknown>>;
    signable: false;
  };
  networkState: NetworkState;
  transactionDigest: string;
}

export interface SignRequest {
  requestId: string;
  chain: SupportedChain;
  accountId: string;
  derivationRef: DerivationReference;
  envelope: SigningEnvelope;
  authorization: SigningAuthorization;
}
