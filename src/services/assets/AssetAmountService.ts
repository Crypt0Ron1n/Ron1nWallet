/**
 * Exact decimal-to-base-unit conversion.
 *
 * No Number()/floating-point arithmetic is used. This service is deliberately
 * independent of any chain so adapters can consume exact bigint quantities.
 */
export class AssetAmountService {
  static decimalToBaseUnits(amount: string, decimals: number): bigint {
    const normalized = amount.trim();

    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid asset decimals.');
    }

    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) {
      throw new Error('Asset amount must be a positive decimal quantity.');
    }

    const [whole, fraction = ''] = normalized.split('.');

    if (fraction.length > decimals) {
      throw new Error(
        `Asset amount exceeds the supported precision of ${decimals} decimal places.`
      );
    }

    const paddedFraction = fraction.padEnd(decimals, '0');
    const baseUnits = BigInt(`${whole}${paddedFraction}`);

    if (baseUnits <= 0n) {
      throw new Error('Asset amount must be greater than zero.');
    }

    return baseUnits;
  }

  static baseUnitsToDecimal(baseUnits: bigint, decimals: number): string {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid asset decimals.');
    }

    if (baseUnits < 0n) {
      throw new Error('Base units cannot be negative.');
    }

    if (decimals === 0) return baseUnits.toString();

    const scale = 10n ** BigInt(decimals);
    const whole = baseUnits / scale;
    const fraction = (baseUnits % scale)
      .toString()
      .padStart(decimals, '0')
      .replace(/0+$/, '');

    return fraction ? `${whole}.${fraction}` : whole.toString();
  }
}
