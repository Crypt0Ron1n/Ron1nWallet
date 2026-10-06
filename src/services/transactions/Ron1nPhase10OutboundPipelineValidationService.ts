import { createTransactionIntentId, type TransactionIntent } from './TransactionIntent';
import { OutboundIntentGuardService } from '../security/OutboundIntentGuardService';

export type Phase10OutboundPipelineValidation = {
  status: 'PASS' | 'FAIL';
  canSign: boolean;
  canBroadcast: boolean;
  decision: string;
  reason: string;
  checkedAt: string;
};

function testIntent(): TransactionIntent {
  return {
    intentId: createTransactionIntentId(),
    accountId: 'runtime-validation',
    asset: {
      symbol: 'ETH',
      chain: 'EVM',
      network: 'Ethereum Mainnet',
      chainId: 1,
      decimals: 18,
    },
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    amount: '0.000000000000000001',
    amountUnit: 'NATIVE',
    sendMode: 'EXACT_SEND',
    securityProfile: 'STANDARD',
    createdAt: Date.now(),
  };
}

export class Ron1nPhase10OutboundPipelineValidationService {
  static run(): Phase10OutboundPipelineValidation {
    const result = OutboundIntentGuardService.evaluate(testIntent(), {
      broadcastSupported: false,
      providerConnected: false,
      providerMode: 'DISABLED',
    });

    const passed =
      !result.canSign &&
      !result.canBroadcast &&
      result.policy.decision === 'BLOCK';

    return {
      status: passed ? 'PASS' : 'FAIL',
      canSign: result.canSign,
      canBroadcast: result.canBroadcast,
      decision: result.policy.decision,
      reason: result.reason,
      checkedAt: new Date().toISOString(),
    };
  }
}
