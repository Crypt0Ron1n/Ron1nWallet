import { buildSparklineGeometry } from './sparklineMath';

export type SparklineMathSelfTestResult = {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

const W = 100;
const H = 32;

function hasNoNaNOrInfinity(points: string): boolean {
  return points
    .split(' ')
    .flatMap((pair) => pair.split(','))
    .every((n) => Number.isFinite(Number(n)));
}

export class SparklineMathSelfTestService {
  static run(): SparklineMathSelfTestResult {
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

    const check = (name: string, passed: boolean, detail: string) => {
      checks.push({ name, passed, detail });
    };

    // 1. Valid historical price array
    const valid = buildSparklineGeometry([10, 12, 11, 13, 15], W, H);
    check(
      'VALID_ARRAY_PRODUCES_GEOMETRY',
      valid !== null && valid.points.split(' ').length === 5 && !valid.flat,
      `Expected 5 points, non-flat. Got ${JSON.stringify(valid)}.`
    );

    // 2. Increasing prices -> last point should be lower y (higher on screen) than first
    const increasing = buildSparklineGeometry([1, 2, 3, 4, 5], W, H);
    const incCoords = increasing!.points.split(' ').map((p) => p.split(',').map(Number));
    check(
      'INCREASING_PRICES_TREND_UPWARD_VISUALLY',
      incCoords[incCoords.length - 1][1] < incCoords[0][1],
      `Last y (${incCoords[incCoords.length - 1][1]}) must be above (smaller than) first y (${incCoords[0][1]}) for rising prices in SVG space.`
    );

    // 3. Decreasing prices -> last point should be lower on screen (higher y)
    const decreasing = buildSparklineGeometry([5, 4, 3, 2, 1], W, H);
    const decCoords = decreasing!.points.split(' ').map((p) => p.split(',').map(Number));
    check(
      'DECREASING_PRICES_TREND_DOWNWARD_VISUALLY',
      decCoords[decCoords.length - 1][1] > decCoords[0][1],
      `Last y (${decCoords[decCoords.length - 1][1]}) must be below (larger than) first y (${decCoords[0][1]}) for falling prices in SVG space.`
    );

    // 4. Mixed prices
    const mixed = buildSparklineGeometry([5, 1, 9, 2, 7, 3], W, H);
    check(
      'MIXED_PRICES_PRODUCES_VALID_GEOMETRY',
      mixed !== null && hasNoNaNOrInfinity(mixed.points),
      `Mixed series must produce finite coordinates. Got ${JSON.stringify(mixed)}.`
    );

    // 5. Flat prices -> flat:true, no NaN from zero-range division
    const flat = buildSparklineGeometry([42, 42, 42, 42], W, H);
    check(
      'FLAT_PRICES_RENDER_FLAT_LINE_NOT_NAN',
      flat !== null && flat.flat && hasNoNaNOrInfinity(flat.points),
      `Identical values must render a flat line, never NaN/Infinity. Got ${JSON.stringify(flat)}.`
    );

    // 6. One data point -> insufficient to draw a line -> null
    const onePoint = buildSparklineGeometry([100], W, H);
    check(
      'ONE_POINT_OMITS_CHART',
      onePoint === null,
      `A single point cannot draw a line - must return null (no chart), not a fabricated shape. Got ${JSON.stringify(onePoint)}.`
    );

    // 7. Empty history
    const empty = buildSparklineGeometry([], W, H);
    check('EMPTY_HISTORY_OMITS_CHART', empty === null, `Empty input must return null. Got ${JSON.stringify(empty)}.`);

    // 8. Missing/null values mixed in
    const withNulls = buildSparklineGeometry([10, null, 12, undefined, 14], W, H);
    check(
      'NULL_VALUES_ARE_FILTERED_NOT_CRASHED_ON',
      withNulls !== null && withNulls.points.split(' ').length === 3 && hasNoNaNOrInfinity(withNulls.points),
      `null/undefined entries must be filtered out, leaving only the 3 real values. Got ${JSON.stringify(withNulls)}.`
    );

    // 9. Invalid/non-numeric values mixed in (NaN, Infinity disguised as numbers)
    const withInvalid = buildSparklineGeometry([10, NaN, 12, Infinity, -Infinity, 14], W, H);
    check(
      'NON_FINITE_VALUES_ARE_FILTERED',
      withInvalid !== null && withInvalid.points.split(' ').length === 3 && hasNoNaNOrInfinity(withInvalid.points),
      `NaN/Infinity entries must be filtered out. Got ${JSON.stringify(withInvalid)}.`
    );

    // 10. Large price values
    const large = buildSparklineGeometry([85000, 86500, 84200, 87100], W, H);
    check(
      'LARGE_VALUES_STAY_FINITE',
      large !== null && hasNoNaNOrInfinity(large.points),
      `Large magnitude prices (e.g. BTC) must still produce finite coordinates. Got ${JSON.stringify(large)}.`
    );

    // 11. Small decimal prices
    const small = buildSparklineGeometry([0.999915, 0.999901, 0.999947, 0.999889], W, H);
    check(
      'SMALL_DECIMAL_VALUES_STAY_FINITE',
      small !== null && hasNoNaNOrInfinity(small.points),
      `Small-range stablecoin-style prices must still produce finite coordinates. Got ${JSON.stringify(small)}.`
    );

    // 12. No price data at all (undefined-filled array, e.g. an asset with no market data)
    const noPriceData = buildSparklineGeometry([undefined, undefined, undefined], W, H);
    check(
      'ALL_MISSING_OMITS_CHART',
      noPriceData === null,
      `An array of entirely missing values must return null. Got ${JSON.stringify(noPriceData)}.`
    );

    // 13. No historical data (empty / not provided at all)
    const noHistory = buildSparklineGeometry([], W, H);
    check(
      'NO_HISTORY_ARRAY_OMITS_CHART',
      noHistory === null,
      `No historical data must gracefully omit the chart, not throw. Got ${JSON.stringify(noHistory)}.`
    );

    // Invalid viewport guard (defensive - must never produce NaN/Infinity geometry)
    const badViewport = buildSparklineGeometry([1, 2, 3], 0, 0);
    check(
      'INVALID_VIEWPORT_NEVER_CRASHES',
      badViewport === null,
      `A zero/invalid viewport must return null rather than dividing by zero. Got ${JSON.stringify(badViewport)}.`
    );

    return {
      passed: checks.every((c) => c.passed),
      checks,
    };
  }
}
