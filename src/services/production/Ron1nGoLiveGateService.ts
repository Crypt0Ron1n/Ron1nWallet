import { Ron1nRuntimeTestService } from '../security/Ron1nRuntimeTestService';
import { ChainMigrationCapabilityRegistry } from '../migration/ChainMigrationCapabilityRegistry';
import { Ron1nPhase15EvmProductionValidationService } from './Ron1nPhase15EvmProductionValidationService';
import { Ron1nPhase17ChainExecutionReadinessService } from './Ron1nPhase17ChainExecutionReadinessService';
import { Ron1nPhase18RecoveryValidationService } from '../transactions/Ron1nPhase18RecoveryValidationService';
import { Ron1nPhase19SecurityHardeningService } from '../security/Ron1nPhase19SecurityHardeningService';
import { Ron1nPhase20FinalSecurityAuditService } from './Ron1nPhase20FinalSecurityAuditService';

export type Ron1nGoLiveGateStatus =
  | 'BLOCKED'
  | 'READY_FOR_DEVICE_VALIDATION'
  | 'READY_FOR_CONTROLLED_ETH_TEST';

export type Ron1nGoLiveGateResult = {
  status: Ron1nGoLiveGateStatus;
  checkedAt: string;
  productionChain: 'ETHEREUM_NATIVE_ETH';
  enabledProductionScope: string[];
  blockedProductionScope: string[];
  blockingReasons: string[];
  manualAcceptanceRequired: string[];
  runtime: Awaited<ReturnType<typeof Ron1nRuntimeTestService.run>>;
  ethereum: Awaited<
    ReturnType<typeof Ron1nPhase15EvmProductionValidationService.run>
  >;
  tokens: {
    status: 'BLOCKED';
    symbols: string[];
    reason: string;
  };
  chains: Awaited<
    ReturnType<typeof Ron1nPhase17ChainExecutionReadinessService.run>
  >;
  recovery: Awaited<
    ReturnType<typeof Ron1nPhase18RecoveryValidationService.run>
  >;
  hardening: Awaited<
    ReturnType<typeof Ron1nPhase19SecurityHardeningService.run>
  >;
  finalAudit: Awaited<
    ReturnType<typeof Ron1nPhase20FinalSecurityAuditService.run>
  >;
};

export class Ron1nGoLiveGateService {
  static async run(): Promise<Ron1nGoLiveGateResult> {
    const [
      runtime,
      ethereum,
      chains,
      recovery,
      hardening,
      finalAudit,
    ] = await Promise.all([
      Ron1nRuntimeTestService.run(),
      Ron1nPhase15EvmProductionValidationService.run(),
      Ron1nPhase17ChainExecutionReadinessService.run(),
      Ron1nPhase18RecoveryValidationService.run(),
      Ron1nPhase19SecurityHardeningService.run(),
      Ron1nPhase20FinalSecurityAuditService.run(),
    ]);

    const tokens = {
      status: 'BLOCKED' as const,
      symbols: ['LINK', 'USDC', 'USDG'],
      reason:
        'Token execution remains blocked until independent ERC-20 transfer, gas, migration, signing, broadcast, and reconciliation validation is complete.',
    };

    const capabilities = ChainMigrationCapabilityRegistry.list();
    const evmCapability = capabilities.find((item) => item.chain === 'EVM');

    const blockingReasons: string[] = [];

    if (runtime.failed > 0) {
      blockingReasons.push(`Runtime security tests failed: ${runtime.failed}.`);
    }

    if (ethereum.status !== 'PASS') {
      blockingReasons.push('Ethereum mainnet production validation did not pass.');
    }

    if (evmCapability?.status !== 'READY') {
      blockingReasons.push('EVM migration capability is not READY.');
    }

    // Phase 18 currently exposes PASS | WARN, not FAIL.
    // WARN is intentionally non-blocking here; the final gate remains responsible
    // for reporting the recovery state without inventing a FAIL state.
    if (recovery.status === 'WARN') {
      blockingReasons.push(
        'Recovery validation returned WARN; complete recovery reconciliation checks before controlled production release.'
      );
    }

    if (hardening.status !== 'PASS') {
      blockingReasons.push('Security hardening validation did not pass.');
    }

    if (finalAudit.status === 'BLOCKED') {
      blockingReasons.push('Final security audit is BLOCKED.');
    }

    const manualAcceptanceRequired = [
      'Physical-device vault creation/unlock and biometric test.',
      'Recovery phrase reveal and fresh-device recovery test.',
      'Real Ethereum RPC connectivity test.',
      'Small-value native ETH Protect Before Send migration.',
      'Small-value native ETH external send.',
      'App termination/restart during SIGNED/BROADCAST/PENDING states.',
      'Network-loss and RPC-timeout reconciliation test.',
      'Final production Android/iOS build test.',
    ];

    const enabledProductionScope = [
      'Ethereum mainnet native ETH outbound execution.',
      'Protect Before Send for the enabled native ETH/EVM migration path.',
      'Transaction lifecycle persistence and reconciliation.',
    ];

    const blockedProductionScope = [
      'ERC-20 token outbound execution (LINK/USDC/USDG).',
      'Bitcoin outbound execution.',
      'Litecoin outbound execution.',
      'Solana outbound execution.',
      'XRP outbound execution.',
      'Stellar outbound execution.',
      'Algorand outbound execution.',
    ];

    const status: Ron1nGoLiveGateStatus =
      blockingReasons.length > 0
        ? 'BLOCKED'
        : 'READY_FOR_DEVICE_VALIDATION';

    return {
      status,
      checkedAt: new Date().toISOString(),
      productionChain: 'ETHEREUM_NATIVE_ETH',
      enabledProductionScope,
      blockedProductionScope,
      blockingReasons,
      manualAcceptanceRequired,
      runtime,
      ethereum,
      tokens,
      chains,
      recovery,
      hardening,
      finalAudit,
    };
  }
}
