import type { SupportedChain } from '../crypto/types';
import type { NetworkState, NetworkStateRequest } from './types';

const EVM_RPC: Record<string, string> = {
  ETH: 'https://ethereum.publicnode.com',
  AVAX: 'https://api.avax.network/ext/bc/C/rpc',
  CRO: 'https://evm.cronos.org',
  BERA: 'https://rpc.berachain.com',
  BASE: 'https://mainnet.base.org',
  POL: 'https://polygon-rpc.com',
  ARB: 'https://arb1.arbitrum.io/rpc',
};

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const XRP_RPC = 'https://s1.ripple.com:51234';
const STELLAR_HORIZON = 'https://horizon.stellar.org';
const ALGO_NODE = 'https://mainnet-api.algonode.cloud';

async function rpc(
  url: string,
  method: string,
  params: unknown[] = []
): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : data.error.message ?? 'RPC request failed'
    );
  }

  return data.result;
}

function networkName(request: NetworkStateRequest): string {
  return request.network.trim() || request.chain;
}

function partial(
  request: NetworkStateRequest,
  warnings: string[],
  values: Partial<NetworkState> = {}
): NetworkState {
  return {
    chain: request.chain,
    network: networkName(request),
    status: 'PARTIAL',
    fetchedAt: Date.now(),
    warnings,
    ...values,
  };
}

export class NetworkStateService {
  static async resolve(
    request: NetworkStateRequest
  ): Promise<NetworkState> {
    switch (request.chain) {
      case 'EVM':
        return this.resolveEvm(request);
      case 'SOLANA':
        return this.resolveSolana(request);
      case 'BITCOIN':
        return this.resolveUtxo(request, 'BTC');
      case 'LITECOIN':
        return this.resolveUtxo(request, 'LTC');
      case 'XRP':
        return this.resolveXrp(request);
      case 'STELLAR':
        return this.resolveStellar(request);
      case 'ALGORAND':
        return this.resolveAlgorand(request);
      default:
        return partial(request, ['Unsupported chain.']);
    }
  }

  private static async resolveEvm(
    request: NetworkStateRequest
  ): Promise<NetworkState> {
    const normalized = request.network.trim().toUpperCase();
    const symbol = normalized === 'ETHEREUM' || normalized === 'ETHEREUM MAINNET'
      ? 'ETH'
      : normalized === 'AVALANCHE' || normalized === 'AVALANCHE C-CHAIN'
        ? 'AVAX'
        : normalized === 'CRONOS'
          ? 'CRO'
          : normalized === 'BERACHAIN'
            ? 'BERA'
            : normalized === 'BASE'
              ? 'BASE'
              : normalized === 'POLYGON' || normalized === 'POLYGON POS'
                ? 'POL'
                : normalized === 'ARBITRUM' || normalized === 'ARBITRUM ONE'
                  ? 'ARB'
                  : normalized;
    const url = EVM_RPC[symbol];

    if (!url) {
      return partial(request, ['No EVM RPC endpoint is configured for this network.']);
    }

    try {
      const [chainIdHex, nonceHex, gasPriceHex, blockHex] = await Promise.all([
        rpc(url, 'eth_chainId'),
        rpc(url, 'eth_getTransactionCount', [request.from, 'pending']),
        rpc(url, 'eth_gasPrice'),
        rpc(url, 'eth_blockNumber'),
      ]);

      const chainId = Number(BigInt(chainIdHex));
      const nonce = Number(BigInt(nonceHex));
      const blockHeight = Number(BigInt(blockHex));

      if (!Number.isSafeInteger(chainId) || !Number.isSafeInteger(nonce)) {
        return partial(request, ['RPC returned an unsafe integer value.']);
      }

      return {
        chain: 'EVM',
        network: networkName(request),
        status: 'READY',
        fetchedAt: Date.now(),
        chainId,
        nonce,
        blockHeight,
        gasPriceBaseUnits: BigInt(gasPriceHex).toString(),
        warnings: [],
      };
    } catch (error) {
      return partial(request, [
        error instanceof Error ? error.message : 'EVM network-state request failed.',
      ]);
    }
  }

  private static async resolveSolana(
    request: NetworkStateRequest
  ): Promise<NetworkState> {
    try {
      const result = await rpc(SOLANA_RPC, 'getLatestBlockhash', [
        { commitment: 'finalized' },
      ]);

      const value = result?.value;
      if (!value?.blockhash || value.lastValidBlockHeight === undefined) {
        return partial(request, ['Solana returned incomplete blockhash state.']);
      }

      return {
        chain: 'SOLANA',
        network: networkName(request),
        status: 'PARTIAL',
        fetchedAt: Date.now(),
        latestBlockhash: value.blockhash,
        lastValidBlockHeight: Number(value.lastValidBlockHeight),
        warnings: [
          'Recent blockhash resolved.',
          'Exact fee requires the final compiled message and fee query.',
        ],
      };
    } catch (error) {
      return partial(request, [
        error instanceof Error
          ? error.message
          : 'Solana network-state request failed.',
      ]);
    }
  }

  private static async resolveUtxo(
    request: NetworkStateRequest,
    symbol: 'BTC' | 'LTC'
  ): Promise<NetworkState> {
    const base =
      symbol === 'BTC'
        ? 'https://blockstream.info/api'
        : 'https://litecoinspace.org/api';

    try {
      const [utxoResponse, feeResponse] = await Promise.all([
        fetch(`${base}/address/${encodeURIComponent(request.from)}/utxo`),
        fetch(`${base}/fee-estimates`),
      ]);

      if (!utxoResponse.ok) {
        throw new Error(`UTXO HTTP ${utxoResponse.status}`);
      }

      const utxoData = await utxoResponse.json();
      const feeData = feeResponse.ok ? await feeResponse.json() : null;

      const utxos = Array.isArray(utxoData)
        ? utxoData.map((item: any) => ({
            txid: String(item.txid),
            vout: Number(item.vout),
            valueBaseUnits: String(item.value),
            statusConfirmed: item.status?.confirmed === true,
          }))
        : [];

      const feeRate =
        feeData && typeof feeData === 'object'
          ? feeData['6'] ?? feeData['3'] ?? feeData['2']
          : undefined;

      return {
        chain: symbol === 'BTC' ? 'BITCOIN' : 'LITECOIN',
        network: networkName(request),
        status: feeRate !== undefined ? 'READY' : 'PARTIAL',
        fetchedAt: Date.now(),
        utxos,
        ...(feeRate !== undefined
          ? { feePerByteBaseUnits: String(feeRate) }
          : {}),
        warnings:
          feeRate !== undefined
            ? []
            : ['UTXOs resolved, but fee-rate endpoint did not return a usable estimate.'],
      };
    } catch (error) {
      return partial(request, [
        error instanceof Error ? error.message : `${symbol} network-state request failed.`,
      ]);
    }
  }

  private static async resolveXrp(
    request: NetworkStateRequest
  ): Promise<NetworkState> {
    try {
      const [account, fee, ledger] = await Promise.all([
        rpc(XRP_RPC, 'account_info', [
          { account: request.from, ledger_index: 'validated' },
        ]),
        rpc(XRP_RPC, 'fee', []),
        rpc(XRP_RPC, 'ledger', [{ ledger_index: 'validated', transactions: false }]),
      ]);

      const sequence = account?.account_data?.Sequence;
      const feeDrops = fee?.drops?.open_ledger_fee;
      const ledgerIndex = ledger?.ledger?.ledger_index;

      if (
        sequence === undefined ||
        feeDrops === undefined ||
        ledgerIndex === undefined
      ) {
        return partial(request, ['XRP returned incomplete account/fee/ledger state.']);
      }

      return {
        chain: 'XRP',
        network: networkName(request),
        status: 'READY',
        fetchedAt: Date.now(),
        sequence: Number(sequence),
        ledgerIndex: Number(ledgerIndex),
        baseFeeBaseUnits: String(feeDrops),
        warnings: [],
      };
    } catch (error) {
      return partial(request, [
        error instanceof Error ? error.message : 'XRP network-state request failed.',
      ]);
    }
  }

  private static async resolveStellar(
    request: NetworkStateRequest
  ): Promise<NetworkState> {
    try {
      const [accountResponse, feeResponse] = await Promise.all([
        fetch(`${STELLAR_HORIZON}/accounts/${encodeURIComponent(request.from)}`),
        fetch(`${STELLAR_HORIZON}/fee_stats`),
      ]);

      if (accountResponse.status === 404) {
        return partial(request, [
          'Stellar source account is not funded/activated.',
        ]);
      }

      if (!accountResponse.ok || !feeResponse.ok) {
        throw new Error(
          `Stellar HTTP account=${accountResponse.status} fee=${feeResponse.status}`
        );
      }

      const account = await accountResponse.json();
      const feeStats = await feeResponse.json();

      const sequence = account.sequence;
      const baseFee = feeStats?.last_ledger_base_fee;

      if (sequence === undefined || baseFee === undefined) {
        return partial(request, ['Stellar returned incomplete account/fee state.']);
      }

      return {
        chain: 'STELLAR',
        network: networkName(request),
        status: 'READY',
        fetchedAt: Date.now(),
        sequence: Number(sequence),
        baseFeeBaseUnits: String(baseFee),
        networkPassphrase: 'Public Global Stellar Network ; September 2015',
        warnings: [],
      };
    } catch (error) {
      return partial(request, [
        error instanceof Error
          ? error.message
          : 'Stellar network-state request failed.',
      ]);
    }
  }

  private static async resolveAlgorand(
    request: NetworkStateRequest
  ): Promise<NetworkState> {
    try {
      const [paramsResponse, accountResponse] = await Promise.all([
        fetch(`${ALGO_NODE}/genesis`),
        fetch(`${ALGO_NODE}/v2/transactions/params`),
      ]);

      if (!paramsResponse.ok || !accountResponse.ok) {
        throw new Error(
          `Algorand HTTP genesis=${paramsResponse.status} params=${accountResponse.status}`
        );
      }

      const genesis = await paramsResponse.json();
      const params = await accountResponse.json();

      return {
        chain: 'ALGORAND',
        network: networkName(request),
        status: 'READY',
        fetchedAt: Date.now(),
        firstValidRound: Number(params['last-round']),
        lastValidRound: Number(params['last-round']) + 1000,
        genesisHash: String(params['genesis-hash'] ?? ''),
        genesisId: String(params['genesis-id'] ?? genesis.id ?? ''),
        round: Number(params['last-round']),
        feeBaseUnits: String(params['min-fee'] ?? '1000'),
        minBalanceBaseUnits: '100000',
        warnings: [],
      };
    } catch (error) {
      return partial(request, [
        error instanceof Error
          ? error.message
          : 'Algorand network-state request failed.',
      ]);
    }
  }
}
