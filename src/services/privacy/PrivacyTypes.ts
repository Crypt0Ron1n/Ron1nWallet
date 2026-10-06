import type { SupportedChain } from '../crypto/types';

/**
 * How strong the user's current privacy posture actually is for an asset.
 *
 * SEPARATED is deliberately distinct from PRIVATE: a fresh address reduces
 * address reuse but is not a privacy-preserving mechanism. Only PRIVATE/
 * MAXIMUM_AVAILABLE may be used when a genuine privacy mechanism is actually
 * in effect - never for ordinary address rotation.
 */
export type PrivacyLevel = 'PUBLIC' | 'SEPARATED' | 'PRIVATE' | 'MAXIMUM_AVAILABLE';

export type PrivacyAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'NOT_IMPLEMENTED';

/**
 * Whether the relationship between identities/transactions can actually be
 * traced. NOT_UNLINKABLE is the deliberately blunt, honest default for any
 * ordinary transparent-chain activity - public or merely address-separated.
 * It must never be upgraded to UNLINKABLE without a genuine privacy
 * mechanism actually in effect.
 */
export type PrivacyLinkability = 'NOT_UNLINKABLE' | 'UNLINKABLE';

export type PrivacyCapabilityKey =
  | 'ADDRESS_SEPARATION'
  | 'IDENTITY_SEPARATION'
  | 'PRIVACY_ROUTE'
  | 'UNLINKABILITY'
  | 'NATIVE_PROTOCOL_PRIVACY';

export type PrivacyCapabilityStatus = {
  availability: PrivacyAvailability;
  explanation: string;
};

export type PrivacyCapabilities = {
  chain: SupportedChain;
  capabilities: Record<PrivacyCapabilityKey, PrivacyCapabilityStatus>;
};

/**
 * User-facing intents, not executed protocol steps. PRIVACY_PROTOCOL and
 * ROTATE_IDENTITY may be reported as unavailable for a given chain; this
 * type describes the vocabulary of possible choices, not a guarantee any of
 * them are implemented.
 */
export type PrivacyAction =
  | 'KEEP'
  | 'CREATE_FRESH_IDENTITY'
  | 'SEPARATE_ASSET'
  | 'PRIVACY_PROTOCOL'
  | 'ROTATE_IDENTITY';

export type PrivacyActionOption = {
  action: PrivacyAction;
  availability: PrivacyAvailability;
  label: string;
  description: string;
};

export type PrivacyExposureSnapshot = {
  receiveIdentityId: string | null;
  holdingIdentityId: string | null;
  spendIdentityId: string | null;
};

export type PrivacyAssessment = {
  chain: SupportedChain;
  asset: string;
  level: PrivacyLevel;
  availability: PrivacyAvailability;
  linkability: PrivacyLinkability;
  currentExposure: PrivacyExposureSnapshot;
  availableActions: PrivacyActionOption[];
  explanation: string[];
  limitations: string[];
  recommendations: string[];
  assessmentVersion: string;
  assessedAt: string;
};

/**
 * Chain-agnostic privacy capability reporting.
 *
 * A strategy only reports what is TRUE for its chain right now - it never
 * signs, broadcasts, holds secrets, or executes a protocol. Dynamic
 * assessment (combining this with identity state) belongs in
 * PrivacyAssessmentService, not here, so every chain strategy doesn't need
 * to reimplement identity-matching logic.
 */
export interface PrivacyStrategy {
  readonly chain: SupportedChain;
  getCapabilities(): PrivacyCapabilities;
}
