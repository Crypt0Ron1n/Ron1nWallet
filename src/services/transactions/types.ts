export type Ron1nTransactionDirection = 'IN' | 'OUT' | 'SELF' | 'UNKNOWN';

export type Ron1nTransactionStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'FAILED'
  | 'UNKNOWN';

export type Ron1nTransaction = {
  id: string;
  chain: string;
  asset: string;
  direction: Ron1nTransactionDirection;
  amount: string;
  from: string;
  to: string;
  timestamp: string;
  status: Ron1nTransactionStatus;
  fee?: string;
  blockNumber?: number;
  explorerUrl?: string;
};