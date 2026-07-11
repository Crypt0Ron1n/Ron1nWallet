import { FeeQuote, FeeQuoteInput } from './types';

function toNumber(value: string) {
  const cleaned = value.replace(/[$,\s]/g, '');
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function toUsd(value: number) {
  return value.toFixed(2);
}

export class FeeQuoteService {
  static createQuote(input: FeeQuoteInput): FeeQuote {
    const amount = toNumber(input.amountUsd);
    const fee = toNumber(input.estimatedFeeUsd);

    if (input.sendMode === 'EXACT_SEND') {
      const totalRequired = amount + fee;

      return {
        asset: input.asset,
        network: input.network,
        sendMode: input.sendMode,
        requestedAmountUsd: toUsd(amount),
        estimatedFeeUsd: toUsd(fee),
        recipientReceivesUsd: toUsd(amount),
        totalRequiredUsd: toUsd(totalRequired),
        shogunFeeUsd: '0.00',
        ron1nFeeUsd: '0.00',
        warning: `To deliver $${toUsd(amount)}, your wallet must also cover the estimated network fee.`,
        feeDisclosure:
          'Network fees are required by the selected blockchain network. Shogun Wallet does not create, control, or receive this fee.',
      };
    }

    const recipientReceives = Math.max(amount - fee, 0);

    return {
      asset: input.asset,
      network: input.network,
      sendMode: input.sendMode,
      requestedAmountUsd: toUsd(amount),
      estimatedFeeUsd: toUsd(fee),
      recipientReceivesUsd: toUsd(recipientReceives),
      totalRequiredUsd: toUsd(amount),
      shogunFeeUsd: '0.00',
      ron1nFeeUsd: '0.00',
      warning: `Because the fee is deducted from the total spend, the recipient may receive approximately $${toUsd(recipientReceives)}.`,
      feeDisclosure:
        'Network fees are required by the selected blockchain network. Shogun Wallet does not create, control, or receive this fee.',
    };
  }
}