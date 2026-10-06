import { Ron1nBalance } from '../balances/types';
import { Ron1nTransaction } from '../transactions/types';
import { ethers } from 'ethers';
import type { SignedPayload } from '../crypto/types';
import type { BroadcastReconciliation } from './types';
import { BaseMockProvider } from './BaseMockProvider';

const RPC_URLS: Record<string, string> = {
  ETH: 'https://ethereum.publicnode.com',
  AVAX: 'https://api.avax.network/ext/bc/C/rpc',
  CRO: 'https://evm.cronos.org',
  BERA: 'https://rpc.berachain.com',
  BASE: 'https://mainnet.base.org',
  POL: 'https://polygon-rpc.com',
  ARB: 'https://arb1.arbitrum.io/rpc',
};

/**
 * EVM JSON-RPC endpoints intentionally remain separate from transaction-history
 * indexing. Standard EVM JSON-RPC does not provide arbitrary address history.
 */
const HISTORY_API_URLS: Record<string, string> = {
  ETH: 'https://eth.blockscout.com/api/v2',
  AVAX: 'https://avax.blockscout.com/api/v2',
  BASE: 'https://base.blockscout.com/api/v2',
  ARB: 'https://arbitrum.blockscout.com/api/v2',
};

function formatUnits(value: bigint, decimals = 18) {
  const negative = value < BigInt(0);
  const raw = negative ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fractionText ? `.${fractionText}` : ''}`;
}

function normalizeAddress(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function blockscoutDirection(
  from: string,
  to: string,
  address: string
): Ron1nTransaction['direction'] {
  const normalizedAddress = address.toLowerCase();
  if (from.toLowerCase() === normalizedAddress && to.toLowerCase() === normalizedAddress) {
    return 'SELF';
  }
  if (from.toLowerCase() === normalizedAddress) {
    return 'OUT';
  }
  if (to.toLowerCase() === normalizedAddress) {
    return 'IN';
  }
  return 'UNKNOWN';
}

function blockscoutStatus(item: any): Ron1nTransaction['status'] {
  const status = String(item?.status ?? item?.result ?? '').toLowerCase();

  if (
    status.includes('fail') ||
    status.includes('error') ||
    status === 'reverted'
  ) {
    return 'FAILED';
  }

  if (
    status.includes('pending') ||
    status === 'pending'
  ) {
    return 'PENDING';
  }

  return 'CONFIRMED';
}

function parseBlockscoutTransaction(
  item: any,
  address: string
): Ron1nTransaction | null {
  const hash = typeof item?.hash === 'string'
    ? item.hash
    : typeof item?.transactionHash === 'string'
      ? item.transactionHash
      : '';

  const from = normalizeAddress(
    item?.from?.hash ??
    item?.from ??
    item?.fromAddress
  );

  const to = normalizeAddress(
    item?.to?.hash ??
    item?.to ??
    item?.toAddress
  );

  if (!hash || !from || !to) {
    return null;
  }

  const rawValue =
    typeof item?.value === 'string'
      ? item.value
      : typeof item?.value === 'number'
        ? String(item.value)
        : '0';

  let amount = '0';
  try {
    amount = formatUnits(BigInt(rawValue), 18);
  } catch {
    amount = '0';
  }

  const timestamp =
    typeof item?.timestamp === 'string'
      ? item.timestamp
      : typeof item?.timeStamp === 'string'
        ? new Date(Number(item.timeStamp) * 1000).toISOString()
        : new Date().toISOString();

  const blockNumber =
    typeof item?.block === 'number'
      ? item.block
      : typeof item?.block_number === 'number'
        ? item.block_number
        : typeof item?.blockNumber === 'number'
          ? item.blockNumber
          : typeof item?.blockNumber === 'string' && item.blockNumber
            ? Number(item.blockNumber)
            : undefined;

  let fee: string | undefined;
  if (typeof item?.fee === 'string') {
    try {
      fee = formatUnits(BigInt(item.fee), 18);
    } catch {
      fee = undefined;
    }
  } else if (typeof item?.gasUsed === 'string' && typeof item?.gasPrice === 'string') {
    try {
      fee = formatUnits(BigInt(item.gasUsed) * BigInt(item.gasPrice), 18);
    } catch {
      fee = undefined;
    }
  }

  return {
    id: hash,
    chain: 'EVM',
    asset: 'ETH',
    direction: blockscoutDirection(from, to, address),
    amount,
    from,
    to,
    timestamp,
    status: blockscoutStatus(item),
    ...(fee !== undefined ? { fee } : {}),
    ...(blockNumber !== undefined ? { blockNumber } : {}),
  };
}

function boundedResponseText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.slice(0, 240);
}

export class EvmProvider extends BaseMockProvider {
  chainId: number;
  rpcUrl?: string;
  historyApiUrl?: string;

  constructor(chain: string, chainId: number, rpcUrl?: string) {
    super(chain, 'EVM');
    this.chainId = chainId;
    this.rpcUrl = rpcUrl ?? RPC_URLS[chain];
    this.historyApiUrl = HISTORY_API_URLS[chain];
  }

  async getStatus() {
    return {
      chain: this.chain,
      family: this.family,
      connected: Boolean(this.rpcUrl),
      mode: this.rpcUrl ? ('RPC' as const) : ('MOCK' as const),
      message: this.rpcUrl
        ? `${this.chain} RPC endpoint configured.`
        : `${this.chain} RPC endpoint not configured.`,
    };
  }

  async estimateFee(): Promise<bigint> {
    if (!this.rpcUrl) {
      return BigInt(0);
    }

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_gasPrice',
        params: [],
      }),
    });

    if (!response.ok) {
      throw new Error(`${this.chain} gas price RPC HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message ?? `${this.chain} gas price RPC error`);
    }

    if (typeof data.result !== 'string') {
      throw new Error('Missing EVM gas price result');
    }

    const gasPriceWei = BigInt(data.result);
    const NATIVE_TRANSFER_GAS_LIMIT = BigInt(21000);

    return NATIVE_TRANSFER_GAS_LIMIT * gasPriceWei;
  }

  async getBalance(address: string): Promise<Ron1nBalance> {
    if (!this.rpcUrl) {
      return super.getBalance(address);
    }

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
      });

      if (!response.ok) {
        throw new Error(`${this.chain} balance RPC HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message ?? `${this.chain} balance RPC error`);
      }

      if (typeof data.result !== 'string') {
        throw new Error('Missing EVM balance result');
      }

      const wei = BigInt(data.result);
      const confirmed = formatUnits(wei, 18);

      return {
        symbol: this.chain,
        address,
        confirmed,
        status: wei > BigInt(0) ? 'ACTIVE' : 'EMPTY',
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        symbol: this.chain,
        address,
        confirmed: '0',
        status: 'ERROR',
        updatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'EVM balance fetch failed',
      };
    }
  }

  /**
   * Broadcast an already-signed legacy EVM transaction.
   *
   * This method deliberately accepts only SignedPayload. It never constructs,
   * signs, or receives secret material.
   */
  async broadcastSignedTransaction(signed: SignedPayload): Promise<string> {
    if (signed.chain !== 'EVM' || signed.kind !== 'RAW_TRANSACTION') {
      throw new Error(
        `${this.chain} broadcast blocked: payload is not an EVM raw transaction`
      );
    }

    if (!this.rpcUrl) {
      throw new Error(`${this.chain} broadcast blocked: RPC endpoint unavailable`);
    }

    if (!/^0x[0-9a-fA-F]+$/.test(signed.rawTransaction)) {
      throw new Error(`${this.chain} broadcast blocked: malformed raw transaction`);
    }

    let parsed: ethers.Transaction;

    try {
      parsed = ethers.Transaction.from(signed.rawTransaction);
    } catch {
      throw new Error(`${this.chain} broadcast blocked: raw transaction is invalid`);
    }

    if (parsed.type !== 0 && parsed.type !== 2) {
      throw new Error(
        `${this.chain} broadcast blocked: unsupported EVM transaction type`
      );
    }

    if (parsed.chainId !== BigInt(this.chainId)) {
      throw new Error(`${this.chain} broadcast blocked: chain ID mismatch`);
    }

    if (!parsed.signature || !parsed.from) {
      throw new Error(`${this.chain} broadcast blocked: transaction is not signed`);
    }

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendRawTransaction',
        params: [signed.rawTransaction],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `${this.chain} broadcast failed: RPC HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(
        `${this.chain} broadcast failed: ${data.error.message ?? 'RPC rejected transaction'}`
      );
    }

    if (
      typeof data.result !== 'string' ||
      !/^0x[0-9a-fA-F]{64}$/.test(data.result)
    ) {
      throw new Error(
        `${this.chain} broadcast failed: RPC returned an invalid transaction hash`
      );
    }

    return data.result;
  }

  private async rpcCall(method: string, params: unknown[]): Promise<any> {
    if (!this.rpcUrl) {
      throw new Error(`${this.chain} reconciliation blocked: RPC endpoint unavailable`);
    }

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });

    if (!response.ok) {
      throw new Error(`${this.chain} ${method} RPC HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message ?? `${this.chain} ${method} RPC error`);
    }

    return data.result;
  }

  /**
   * Reconcile an already-broadcast EVM transaction. This never constructs or
   * signs anything - it only reads chain state for a known hash.
   *
   * - A receipt with status 0x1 is CONFIRMED.
   * - A receipt with status 0x0 is FAILED (the transaction was mined but reverted).
   * - No receipt, but the node still returns the transaction: PENDING (known to
   *   the node, not yet mined).
   * - No receipt and the node has no record of the transaction: UNKNOWN. This
   *   is deliberately not FAILED - a transaction can be temporarily invisible
   *   (not yet propagated, or evicted from this node's mempool) without being
   *   provably dead, and callers must keep reconciling rather than giving up.
   */
  async reconcileBroadcast(transactionHash: string): Promise<BroadcastReconciliation> {
    if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
      throw new Error(`${this.chain} reconciliation blocked: invalid transaction hash`);
    }

    if (!this.rpcUrl) {
      throw new Error(`${this.chain} reconciliation blocked: RPC endpoint unavailable`);
    }

    const observedAt = new Date().toISOString();
    const receipt = await this.rpcCall('eth_getTransactionReceipt', [transactionHash]);

    if (receipt && typeof receipt === 'object') {
      const statusHex: string | undefined = receipt.status;
      const blockNumberHex: string | undefined = receipt.blockNumber;
      const blockNumber =
        typeof blockNumberHex === 'string' ? Number(BigInt(blockNumberHex)) : undefined;

      if (statusHex === '0x0') {
        return { transactionHash, status: 'FAILED', blockNumber, observedAt };
      }

      if (statusHex === '0x1') {
        let confirmations: number | undefined;

        try {
          const latestHex = await this.rpcCall('eth_blockNumber', []);
          const latest = Number(BigInt(latestHex));

          if (blockNumber !== undefined && Number.isSafeInteger(latest)) {
            confirmations = Math.max(1, latest - blockNumber + 1);
          }
        } catch {
          // Confirmation depth is best-effort; CONFIRMED itself does not depend on it.
        }

        return { transactionHash, status: 'CONFIRMED', blockNumber, confirmations, observedAt };
      }

      // A receipt exists but its status field is unrecognized - treat it
      // conservatively as still pending rather than guessing CONFIRMED/FAILED.
      return { transactionHash, status: 'PENDING', blockNumber, observedAt };
    }

    const tx = await this.rpcCall('eth_getTransactionByHash', [transactionHash]);

    if (tx && typeof tx === 'object') {
      return { transactionHash, status: 'PENDING', observedAt };
    }

    return { transactionHash, status: 'UNKNOWN', observedAt };
  }

  /**
   * Address history requires an indexer. Standard Ethereum JSON-RPC exposes
   * balance, receipts, blocks, logs, etc., but does not expose arbitrary
   * address transaction history.
   *
   * The primary endpoint is Blockscout v2. A legacy Blockscout account API
   * fallback is also attempted because some Blockscout deployments return
   * HTTP 422 for otherwise valid v2 address-history requests.
   *
   * Never return [] when the history provider is unavailable: doing so would
   * incorrectly classify a used address as fresh.
   */
  async getTransactions(address: string): Promise<Ron1nTransaction[]> {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`${this.chain} transaction history blocked: invalid EVM address`);
    }

    if (!this.historyApiUrl) {
      throw new Error(
        `${this.chain} transaction history unavailable: no production history indexer is configured`
      );
    }

    // Blockscout v2 uses cursor-based pagination (next_page_params in the
    // response), not a literal "page" query param - sending one is rejected
    // outright with HTTP 422, which forced every single call down to the
    // rate-limited legacy fallback below. The first page needs no params.
    const v2Url = `${this.historyApiUrl}/addresses/${encodeURIComponent(address)}/transactions`;

    let v2Failure = '';

    try {
      const response = await fetch(v2Url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const body = await response.text();

      if (!response.ok) {
        v2Failure =
          `v2 HTTP ${response.status}` +
          (body ? `: ${boundedResponseText(body)}` : '');
      } else {
        let data: any;

        try {
          data = JSON.parse(body);
        } catch {
          v2Failure = 'v2 returned non-JSON response';
          data = undefined;
        }

        if (data && Array.isArray(data.items)) {
          return data.items
            .map((item: any) => parseBlockscoutTransaction(item, address))
            .filter(
              (item: Ron1nTransaction | null): item is Ron1nTransaction =>
                item !== null
            );
        }

        if (!v2Failure) {
          v2Failure = 'v2 returned an invalid response shape';
        }
      }
    } catch (error) {
      v2Failure =
        error instanceof Error
          ? `v2 request failed: ${boundedResponseText(error.message)}`
          : 'v2 request failed';
    }

    // Blockscout retains a legacy account endpoint on the same explorer host.
    // This fallback is intentionally read-only and returns native transactions.
    const legacyBase = this.historyApiUrl.replace(/\/api\/v2\/?$/, '');
    const legacyUrl =
      `${legacyBase}/api?module=account&action=txlist` +
      `&address=${encodeURIComponent(address)}&page=1&offset=100&sort=desc`;

    try {
      const response = await fetch(legacyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `legacy HTTP ${response.status}` +
          (body ? `: ${boundedResponseText(body)}` : '')
        );
      }

      let data: any;
      try {
        data = JSON.parse(body);
      } catch {
        throw new Error('legacy returned non-JSON response');
      }

      if (data?.status === '1' && Array.isArray(data?.result)) {
        return data.result
          .map((item: any) => parseBlockscoutTransaction(item, address))
          .filter(
            (item: Ron1nTransaction | null): item is Ron1nTransaction =>
              item !== null
          );
      }

      if (Array.isArray(data?.result)) {
        return data.result
          .map((item: any) => parseBlockscoutTransaction(item, address))
          .filter(
            (item: Ron1nTransaction | null): item is Ron1nTransaction =>
              item !== null
          );
      }

      const legacyMessage =
        typeof data?.message === 'string'
          ? data.message
          : typeof data?.result === 'string'
            ? data.result
            : 'invalid legacy response';

      throw new Error(legacyMessage);
    } catch (error) {
      const legacyFailure =
        error instanceof Error
          ? boundedResponseText(error.message)
          : 'legacy request failed';

      throw new Error(
        `${this.chain} transaction history unavailable: ${v2Failure}; ${legacyFailure}`
      );
    }
  }
}


