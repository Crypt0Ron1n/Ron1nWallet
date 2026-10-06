import type { SupportedChain } from '../crypto/types';
import { IdentityRegistryService } from '../identity/IdentityRegistryService';
import { PrivacyPolicyEngine } from './PrivacyPolicyEngine';
import { PrivacyStrategyRegistry } from './PrivacyStrategyRegistry';
import type {
  PrivacyActionOption,
  PrivacyAssessment,
  PrivacyAvailability,
  PrivacyCapabilities,
  PrivacyLevel,
  PrivacyLinkability,
} from './PrivacyTypes';

export const PRIVACY_ASSESSMENT_VERSION = '1.0.0';

export type DerivedPrivacyLevelInput = {
  capabilities: PrivacyCapabilities;
  hasHoldingIdentity: boolean;
  /** Always false until a real chain-specific privacy protocol is implemented and wired to execution. */
  hasActivePrivacyRoute: boolean;
};

export type DerivedPrivacyLevel = {
  level: PrivacyLevel;
  availability: PrivacyAvailability;
  linkability: PrivacyLinkability;
};

/**
 * Pure mapping from capability/identity facts to a privacy level. Kept
 * separate from any storage access so it can be exercised directly by
 * PrivacySelfTestService without touching AsyncStorage.
 */
export function derivePrivacyLevel(input: DerivedPrivacyLevelInput): DerivedPrivacyLevel {
  const { capabilities } = input;

  if (input.hasActivePrivacyRoute) {
    const routeAvailability = capabilities.capabilities.PRIVACY_ROUTE.availability;

    if (routeAvailability === 'AVAILABLE' || routeAvailability === 'LIMITED') {
      const native = capabilities.capabilities.NATIVE_PROTOCOL_PRIVACY.availability === 'AVAILABLE';

      return {
        level: native ? 'MAXIMUM_AVAILABLE' : 'PRIVATE',
        availability: routeAvailability,
        linkability: 'UNLINKABLE',
      };
    }
  }

  if (input.hasHoldingIdentity) {
    return {
      level: 'SEPARATED',
      availability: capabilities.capabilities.IDENTITY_SEPARATION.availability,
      linkability: 'NOT_UNLINKABLE',
    };
  }

  return {
    level: 'PUBLIC',
    availability: 'AVAILABLE',
    linkability: 'NOT_UNLINKABLE',
  };
}

function buildActions(
  capabilities: PrivacyCapabilities,
  hasHoldingIdentity: boolean
): PrivacyActionOption[] {
  const caps = capabilities.capabilities;

  return [
    {
      action: 'KEEP',
      availability: 'AVAILABLE',
      label: 'Keep As Is',
      description: 'Continue using the current identity. Nothing changes.',
    },
    {
      action: 'CREATE_FRESH_IDENTITY',
      availability: hasHoldingIdentity ? 'LIMITED' : caps.IDENTITY_SEPARATION.availability,
      label: 'Separate Identity',
      description: hasHoldingIdentity
        ? 'A separated holding identity already exists for this asset.'
        : 'Reserve a fresh holding identity for this asset. This reduces address reuse but does not make transfers unlinkable.',
    },
    {
      action: 'PRIVACY_PROTOCOL',
      availability: caps.PRIVACY_ROUTE.availability,
      label: 'Protect Asset',
      description: caps.PRIVACY_ROUTE.explanation,
    },
    {
      action: 'ROTATE_IDENTITY',
      availability: caps.ADDRESS_SEPARATION.availability,
      label: 'Rotate Identity',
      description: 'Rotate to a fresh receive identity for future deposits.',
    },
  ];
}

/**
 * Combines a chain's static privacy capabilities with the account's actual
 * identity-registry state into a single honest assessment. This is the only
 * place that does the identity-matching work - individual PrivacyStrategy
 * implementations stay chain-capability-only so adding a new chain never
 * requires reimplementing this orchestration.
 */
export class PrivacyAssessmentService {
  static async assess(
    accountId: string,
    chain: SupportedChain,
    asset: string,
    receiveAddress: string
  ): Promise<PrivacyAssessment> {
    const capabilities = PrivacyStrategyRegistry.get(chain).getCapabilities();
    const identities = await IdentityRegistryService.list(accountId, chain);
    const normalized = receiveAddress.trim().toLowerCase();

    const receiveIdentity =
      identities.find(
        (identity) => identity.purpose === 'INGRESS' && identity.address.toLowerCase() === normalized
      ) ?? null;

    const holdingIdentity = receiveIdentity
      ? identities.find(
          (identity) =>
            identity.purpose === 'VAULT' && identity.linkedIdentityId === receiveIdentity.identityId
        ) ?? null
      : null;

    const spendIdentity =
      identities.find((identity) => identity.purpose === 'SPEND' && identity.lifecycle === 'ACTIVE') ??
      null;

    const derived = derivePrivacyLevel({
      capabilities,
      hasHoldingIdentity: Boolean(holdingIdentity),
      hasActivePrivacyRoute: false,
    });

    const policy = PrivacyPolicyEngine.evaluate(chain, {
      sendingOut: false,
      receivingIdentityUsed: Boolean(receiveIdentity) && receiveIdentity?.lifecycle !== 'RESERVED',
      maximumPrivacy: false,
      privacyTransitionSupported: capabilities.capabilities.IDENTITY_SEPARATION.availability === 'AVAILABLE',
      chainNativePrivacy: capabilities.capabilities.NATIVE_PROTOCOL_PRIVACY.availability === 'AVAILABLE',
    });

    const explanation = [capabilities.capabilities.UNLINKABILITY.explanation, policy.linkabilityDisclosure];

    const limitations = [
      'The original on-chain deposit to the receive identity remains permanently visible and cannot be erased.',
      capabilities.capabilities.PRIVACY_ROUTE.availability === 'NOT_IMPLEMENTED' ||
      capabilities.capabilities.PRIVACY_ROUTE.availability === 'UNAVAILABLE'
        ? capabilities.capabilities.PRIVACY_ROUTE.explanation
        : null,
    ].filter((item): item is string => Boolean(item));

    const recommendations = [
      !holdingIdentity && capabilities.capabilities.IDENTITY_SEPARATION.availability === 'AVAILABLE'
        ? 'Consider separating this asset into a fresh holding identity to reduce future address reuse.'
        : null,
    ].filter((item): item is string => Boolean(item));

    return {
      chain,
      asset,
      level: derived.level,
      availability: derived.availability,
      linkability: derived.linkability,
      currentExposure: {
        receiveIdentityId: receiveIdentity?.identityId ?? null,
        holdingIdentityId: holdingIdentity?.identityId ?? null,
        spendIdentityId: spendIdentity?.identityId ?? null,
      },
      availableActions: buildActions(capabilities, Boolean(holdingIdentity)),
      explanation,
      limitations,
      recommendations,
      assessmentVersion: PRIVACY_ASSESSMENT_VERSION,
      assessedAt: new Date().toISOString(),
    };
  }
}
