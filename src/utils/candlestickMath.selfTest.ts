import { buildCandlestickGeometry, pointsToCandles } from './candlestickMath';

export type CandlestickMathSelfTestResult = {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

const W = 100;
const H = 32;

function hasNoNaNOrInfinity(geometry: ReturnType<typeof buildCandlestickGeometry>): boolean {
  if (!geometry) return true;
  return geometry.every((c) =>
    [c.x, c.wickTop, c.wickBottom, c.bodyTop, c.bodyBottom, c.bodyWidth].every((n) => Number.isFinite(n))
  );
}

export class CandlestickMathSelfTestService {
  static run(): CandlestickMathSelfTestResult {
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
    const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });

    const valid = buildCandlestickGeometry(
      [
        { o: 10, h: 12, l: 9, c: 11 },
        { o: 11, h: 11.5, l: 8, c: 8.5 },
        { o: 8.5, h: 13, l: 8, c: 12 },
      ],
      W,
      H
    );
    check(
      'VALID_CANDLES_PRODUCE_GEOMETRY',
      valid !== null && valid.length === 3 && hasNoNaNOrInfinity(valid),
      `Expected 3 finite candle geometries. Got ${JSON.stringify(valid)}.`
    );

    const upCandle = buildCandlestickGeometry([{ o: 10, h: 12, l: 9, c: 11 }], W, H);
    check(
      'UP_CANDLE_FLAGGED_CORRECTLY',
      upCandle !== null && upCandle[0].up === true,
      `close > open must flag up=true. Got ${JSON.stringify(upCandle)}.`
    );

    const downCandle = buildCandlestickGeometry([{ o: 11, h: 12, l: 9, c: 10 }], W, H);
    check(
      'DOWN_CANDLE_FLAGGED_CORRECTLY',
      downCandle !== null && downCandle[0].up === false,
      `close < open must flag up=false. Got ${JSON.stringify(downCandle)}.`
    );

    const wickEncloses = buildCandlestickGeometry([{ o: 10, h: 15, l: 5, c: 12 }], W, H);
    check(
      'WICK_ENCLOSES_BODY',
      wickEncloses !== null &&
        wickEncloses[0].wickTop <= wickEncloses[0].bodyTop &&
        wickEncloses[0].wickBottom >= wickEncloses[0].bodyBottom,
      `The high-low wick must fully enclose the open-close body. Got ${JSON.stringify(wickEncloses)}.`
    );

    const doji = buildCandlestickGeometry([{ o: 10, h: 11, l: 9, c: 10 }], W, H);
    check(
      'DOJI_CANDLE_STAYS_VISIBLE_NOT_ZERO_HEIGHT',
      doji !== null && doji[0].bodyBottom - doji[0].bodyTop >= 1 && hasNoNaNOrInfinity(doji),
      `A doji (open === close) must render a visible hairline body, never a zero-height/invisible rectangle. Got ${JSON.stringify(doji)}.`
    );

    const flat = buildCandlestickGeometry(
      [
        { o: 5, h: 5, l: 5, c: 5 },
        { o: 5, h: 5, l: 5, c: 5 },
      ],
      W,
      H
    );
    check(
      'FLAT_SERIES_NEVER_PRODUCES_NAN',
      flat !== null && hasNoNaNOrInfinity(flat),
      `An entirely flat series (zero range) must not divide by zero. Got ${JSON.stringify(flat)}.`
    );

    const onePoint = buildCandlestickGeometry([{ o: 10, h: 11, l: 9, c: 10.5 }], W, H);
    check(
      'SINGLE_CANDLE_RENDERS_CENTERED',
      onePoint !== null && onePoint.length === 1 && hasNoNaNOrInfinity(onePoint),
      `A single candle must still render (centered), not crash. Got ${JSON.stringify(onePoint)}.`
    );

    const empty = buildCandlestickGeometry([], W, H);
    check('EMPTY_SERIES_OMITS_CHART', empty === null, `Empty input must return null. Got ${JSON.stringify(empty)}.`);

    const withInvalid = buildCandlestickGeometry(
      [
        { o: 10, h: 12, l: 9, c: 11 },
        { o: NaN, h: Infinity, l: -Infinity, c: NaN },
        { o: 11, h: 13, l: 10, c: 12 },
      ],
      W,
      H
    );
    check(
      'NON_FINITE_CANDLES_ARE_FILTERED',
      withInvalid !== null && withInvalid.length === 2 && hasNoNaNOrInfinity(withInvalid),
      `Candles with any non-finite OHLC value must be dropped, not crash the rest. Got ${JSON.stringify(withInvalid)}.`
    );

    const allInvalid = buildCandlestickGeometry([{ o: NaN, h: NaN, l: NaN, c: NaN }], W, H);
    check(
      'ALL_INVALID_OMITS_CHART',
      allInvalid === null,
      `A series with no valid candles must return null. Got ${JSON.stringify(allInvalid)}.`
    );

    const badViewport = buildCandlestickGeometry([{ o: 1, h: 2, l: 0, c: 1 }], 0, 0);
    check(
      'INVALID_VIEWPORT_NEVER_CRASHES',
      badViewport === null,
      `A zero/invalid viewport must return null. Got ${JSON.stringify(badViewport)}.`
    );

    // pointsToCandles: downsampling a real point-sampled price series into
    // fixed-width buckets (used for 5m/15m timeframes derived from
    // CoinGecko's 5-minute market_chart snapshots).
    const fiveMin = 5 * 60 * 1000;

    const threeRealPoints = [
      { t: 0, price: 10 },
      { t: fiveMin, price: 12 },
      { t: fiveMin * 2, price: 9 },
    ];

    const oneBucketPerPoint = pointsToCandles(threeRealPoints, fiveMin);
    check(
      'RESAMPLE_ONE_BUCKET_PER_POINT_WHEN_BUCKET_MATCHES_SPACING',
      oneBucketPerPoint.length === 3 &&
        oneBucketPerPoint[0].o === 10 &&
        oneBucketPerPoint[0].c === 10 &&
        oneBucketPerPoint[0].h === 10 &&
        oneBucketPerPoint[0].l === 10,
      `A bucket width equal to point spacing must yield one real (o=h=l=c) candle per point. Got ${JSON.stringify(oneBucketPerPoint)}.`
    );

    const fifteenMinBucket = pointsToCandles(threeRealPoints, fiveMin * 3);
    check(
      'RESAMPLE_MERGES_REAL_POINTS_INTO_WIDER_BUCKET',
      fifteenMinBucket.length === 1 &&
        fifteenMinBucket[0].o === 10 &&
        fifteenMinBucket[0].c === 9 &&
        fifteenMinBucket[0].h === 12 &&
        fifteenMinBucket[0].l === 9,
      `A 15m bucket over 3 real 5m points must use the first point as open, last as close, and the real max/min as high/low. Got ${JSON.stringify(fifteenMinBucket)}.`
    );

    const emptyPoints = pointsToCandles([], fiveMin);
    check('RESAMPLE_EMPTY_INPUT_RETURNS_EMPTY', emptyPoints.length === 0, `Expected []. Got ${JSON.stringify(emptyPoints)}.`);

    const invalidPoints = pointsToCandles(
      [{ t: 0, price: 10 }, { t: NaN, price: Infinity }, { t: fiveMin, price: 11 }],
      fiveMin
    );
    check(
      'RESAMPLE_FILTERS_NON_FINITE_POINTS',
      invalidPoints.length === 2,
      `Non-finite points must be dropped, not corrupt the resample. Got ${JSON.stringify(invalidPoints)}.`
    );

    const badBucket = pointsToCandles(threeRealPoints, 0);
    check('RESAMPLE_INVALID_BUCKET_WIDTH_RETURNS_EMPTY', badBucket.length === 0, `Expected []. Got ${JSON.stringify(badBucket)}.`);

    return {
      passed: checks.every((c) => c.passed),
      checks,
    };
  }
}
