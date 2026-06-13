export type Ron1nBalanceStatus = 'ACTIVE' | 'EMPTY' | 'UNFUNDED' | 'ERROR';

export type Ron1nBalance = {
  symbol: string;
  address: string;
  confirmed: string;
  pending?: string;
  status: Ron1nBalanceStatus;
  updatedAt: string;
  message?: string;
};