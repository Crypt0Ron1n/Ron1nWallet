import {
  createTransactionIntentId,
  validateTransactionIntent,
  type TransactionIntent,
} from '../transactions/TransactionIntent';
import { SecurityPolicyEngine } from '../SecurityPolicyEngine';

export type Ron1nRuntimeTestStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';

export type Ron1nRuntimeTestResult = {
  id: string;
  name: string;
  status: Ron1nRuntimeTestStatus;
  detail: string;
  durationMs: number;
};

export type Ron1nRuntimeTestReport = {
  startedAt: string;
  completedAt: string;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  tests: Ron1nRuntimeTestResult[];
};

const TEST_ACCOUNT = 'primary';
const TEST_FROM = '0x1111111111111111111111111111111111111111';
const TEST_TO = '0x2222222222222222222222222222222222222222';

function validIntent(): TransactionIntent {
  return {
    intentId: createTransactionIntentId(),
    accountId: TEST_ACCOUNT,
    asset: {
      symbol: 'ETH',
      chain: 'EVM',
      network: 'Ethereum Mainnet',
      chainId: 1,
      decimals: 18,
    },
    from: TEST_FROM,
    to: TEST_TO,
    amount: '0.01',
    amountUnit: 'NATIVE',
    sendMode: 'EXACT_SEND',
    securityProfile: 'STANDARD',
    createdAt: Date.now(),
  };
}

function run(
  id: string,
  name: string,
  test: () => boolean | { status: Ron1nRuntimeTestStatus; detail: string }
): Ron1nRuntimeTestResult {
  const started = Date.now();

  try {
    const result = test();

    if (typeof result === 'boolean') {
      return {
        id,
        name,
        status: result ? 'PASS' : 'FAIL',
        detail: result ? 'Expected runtime invariant held.' : 'Expected runtime invariant failed.',
        durationMs: Date.now() - started,
      };
    }

    return {
      id,
      name,
      status: result.status,
      detail: result.detail,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      id,
      name,
      status: 'FAIL',
      detail: error instanceof Error ? error.message : 'Runtime test threw an unknown error.',
      durationMs: Date.now() - started,
    };
  }
}

export class Ron1nRuntimeTestService {
  static async run(): Promise<Ron1nRuntimeTestReport> {
    const startedAt = new Date().toISOString();
    const tests: Ron1nRuntimeTestResult[] = [];

    tests.push(
      run('intent-valid', 'Valid transaction intent', () => {
        return validateTransactionIntent(validIntent()).valid;
      }),

      run('intent-zero', 'Zero transaction amount rejected', () => {
        const intent = validIntent();
        intent.amount = '0';
        return !validateTransactionIntent(intent).valid;
      }),

      run('intent-negative', 'Negative transaction amount rejected', () => {
        const intent = validIntent();
        intent.amount = '-1';
        return !validateTransactionIntent(intent).valid;
      }),

      run('intent-secret', 'Secret-like metadata rejected', () => {
        const intent = validIntent();
        intent.metadata = {
          note: 'private key must never appear here',
        };
        const result = validateTransactionIntent(intent);
        return !result.valid && result.codes.includes('SECRET_MATERIAL_PRESENT');
      }),

      run('intent-missing-recipient', 'Missing recipient rejected', () => {
        const intent = validIntent();
        intent.to = '';
        return !validateTransactionIntent(intent).valid;
      }),

      run('policy-boundary', 'Policy engine returns a decision', () => {
        const intent = validIntent();
        const result = SecurityPolicyEngine.evaluate(intent, null, {
          broadcastSupported: true,
          providerConnected: true,
          providerMode: 'RPC',
        });
        return ['ALLOW', 'RECOMMEND_ROTATION', 'REQUIRE_ROTATION', 'BLOCK'].includes(
          result.decision
        );
      }),

      run('migration-block', 'Migration-required intent cannot silently become a normal send', () => {
        const intent = validIntent();
        intent.securityProfile = 'MAXIMUM';

        const result = SecurityPolicyEngine.evaluate(intent, null, {
          broadcastSupported: true,
          providerConnected: true,
          providerMode: 'RPC',
        });

        return {
          status: result.requiresMigration ? 'PASS' : 'FAIL',
          detail: result.requiresMigration
            ? 'MAXIMUM profile correctly requires migration.'
            : 'MAXIMUM profile did not require migration.',
        };
      }),

      run('provider-boundary', 'Unavailable provider fails closed', () => {
        const intent = validIntent();
        const result = SecurityPolicyEngine.evaluate(intent, null, {
          broadcastSupported: false,
          providerConnected: false,
          providerMode: 'MOCK',
        });

        return {
          status: result.decision === 'BLOCK' ? 'PASS' : 'FAIL',
          detail:
            result.decision === 'BLOCK'
              ? 'Unavailable/mock broadcast capability was blocked.'
              : `Unexpected decision: ${result.decision}`,
        };
      }),
    );

    const completedAt = new Date().toISOString();
    const passed = tests.filter((test) => test.status === 'PASS').length;
    const failed = tests.filter((test) => test.status === 'FAIL').length;
    const blocked = tests.filter((test) => test.status === 'BLOCKED').length;
    const skipped = tests.filter((test) => test.status === 'SKIPPED').length;

    return {
      startedAt,
      completedAt,
      passed,
      failed,
      blocked,
      skipped,
      tests,
    };
  }
}
