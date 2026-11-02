export type Candle = { o: number; h: number; l: number; c: number };
export type PricePoint = { t: number; price: number };

/**
 * Builds real OHLC candles from a real point-sampled price series (e.g.
 * CoinGecko's 5-minute market_chart snapshots), by grouping points into
 * fixed-width time buckets. This is standard downsampling, not
 * fabrication: every open/high/low/close value is a price that was
 * actually observed at an actual timestamp - a bucket containing only one
 * point simply has no observed intrabar movement, so its wick correctly
 * equals its body (o=h=l=c), rather than inventing one.
 *
 * Points must be chronological. Returns [] for empty input.
 */
export function pointsToCandles(points: ReadonlyArray<PricePoint>, bucketMs: number): Candle[] {
  if (points.length === 0 || !Number.isFinite(bucketMs) || bucketMs <= 0) {
    return [];
  }

  const valid = points.filter(
    (point) => Number.isFinite(point.t) && Number.isFinite(point.price)
  );

  if (valid.length === 0) {
    return [];
  }

  const buckets = new Map<number, number[]>();

  for (const point of valid) {
    const bucketKey = Math.floor(point.t / bucketMs);
    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.push(point.price);
    } else {
      buckets.set(bucketKey, [point.price]);
    }
  }

  return Array.from(buckets.keys())
    .sort((a, b) => a - b)
    .map((key) => {
      const prices = buckets.get(key) as number[];
      return {
        o: prices[0],
        c: prices[prices.length - 1],
        h: Math.max(...prices),
        l: Math.min(...prices),
      };
    });
}

export type CandleGeometry = {
  /** Center-x of the candle's wick/body, in the viewBox's coordinate space. */
  x: number;
  /** Top/bottom of the high-low wick line. */
  wickTop: number;
  wickBottom: number;
  /** Top/bottom of the open-close body rectangle. */
  bodyTop: number;
  bodyBottom: number;
  bodyWidth: number;
  up: boolean;
};

/**
 * Converts a real OHLC series into safe SVG candle coordinates within a
 * fixed virtual viewBox (paired with viewBox-based scaling in the
 * candlestick component). Mirrors sparklineMath's safety guarantees: never
 * produces NaN/Infinity, never fabricates a candle, and returns null
 * whenever a real chart cannot be drawn.
 */
export function buildCandlestickGeometry(
  candles: ReadonlyArray<Candle>,
  viewWidth: number,
  viewHeight: number,
  verticalPadding = 2
): CandleGeometry[] | null {
  if (!Number.isFinite(viewWidth) || !Number.isFinite(viewHeight) || viewWidth <= 0 || viewHeight <= 0) {
    return null;
  }

  const valid = candles.filter(
    (candle) =>
      Number.isFinite(candle.o) &&
      Number.isFinite(candle.h) &&
      Number.isFinite(candle.l) &&
      Number.isFinite(candle.c)
  );

  if (valid.length === 0) {
    return null;
  }

  const allValues = valid.flatMap((candle) => [candle.o, candle.h, candle.l, candle.c]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min;

  const padding = Math.min(Math.max(verticalPadding, 0), viewHeight / 2);
  const usableHeight = Math.max(viewHeight - padding * 2, 0);
  const lastIndex = valid.length - 1;

  const slot = lastIndex === 0 ? viewWidth : viewWidth / valid.length;
  const bodyWidth = Math.max(slot * 0.6, 1);

  const toY = (value: number) =>
    range === 0 ? viewHeight / 2 : viewHeight - padding - ((value - min) / range) * usableHeight;

  return valid.map((candle, index) => {
    const x = lastIndex === 0 ? viewWidth / 2 : (index + 0.5) * slot;
    const bodyTopValue = Math.max(candle.o, candle.c);
    const bodyBottomValue = Math.min(candle.o, candle.c);

    const wickTop = toY(candle.h);
    const wickBottom = toY(candle.l);
    let bodyTop = toY(bodyTopValue);
    let bodyBottom = toY(bodyBottomValue);

    // A perfectly flat body (open === close) would render as a zero-height
    // rectangle - give it a hairline so a "doji" candle is still visible
    // rather than silently disappearing.
    if (bodyBottom - bodyTop < 1) {
      const mid = (bodyTop + bodyBottom) / 2;
      bodyTop = mid - 0.5;
      bodyBottom = mid + 0.5;
    }

    return {
      x: Number.isFinite(x) ? x : 0,
      wickTop: Number.isFinite(wickTop) ? wickTop : viewHeight / 2,
      wickBottom: Number.isFinite(wickBottom) ? wickBottom : viewHeight / 2,
      bodyTop: Number.isFinite(bodyTop) ? bodyTop : viewHeight / 2,
      bodyBottom: Number.isFinite(bodyBottom) ? bodyBottom : viewHeight / 2,
      bodyWidth,
      up: candle.c >= candle.o,
    };
  });
}
