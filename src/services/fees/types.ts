export type SendMode = 'EXACT_SEND' | 'SPEND_TOTAL';

export type FeeQuoteInput = {
  asset: string;
  network: string;
  amountUsd: string;
  estimatedFeeUsd: string;
  sendMode: SendMode;
};

export type FeeQuote = {
  asset: string;
  network: string;
  sendMode: SendMode;
  requestedAmountUsd: string;
  estimatedFeeUsd: string;
  recipientReceivesUsd: string;
  totalRequiredUsd: string;
  shogunFeeUsd: string;
  ron1nFeeUsd: string;
  warning: string;
  feeDisclosure: string;
};