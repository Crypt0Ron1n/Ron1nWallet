export type SparklineGeometry = {
  /** Space-separated "x,y x,y ..." points, ready for an SVG <Polyline>. */
  points: string;
  /** True when every valid input value was identical (a flat line was drawn). */
  flat: boolean;
};

/**
 * Converts a raw price series into safe SVG polyline coordinates within a
 * fixed virtual viewBox (paired with viewBox-based scaling in the sparkline
 * component, so the caller never needs real pixel width).
 *
 * Returns null whenever a real line cannot be drawn - callers must render no
 * chart at all in that case, never a fabricated one:
 * - fewer than 2 finite values after filtering out null/undefined/NaN/Infinity
 *
 * A single remaining distinct value (every point flat) still renders - a flat
 * line is real data (the asset genuinely did not move), not a fabrication.
 */
export function buildSparklineGeometry(
  values: ReadonlyArray<number | null | undefined>,
  viewWidth: number,
  viewHeight: number,
  verticalPadding = 2
): SparklineGeometry | null {
  if (!Number.isFinite(viewWidth) || !Number.isFinite(viewHeight) || viewWidth <= 0 || viewHeight <= 0) {
    return null;
  }

  const finite = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );

  if (finite.length < 2) {
    return null;
  }

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min;

  const padding = Math.min(Math.max(verticalPadding, 0), viewHeight / 2);
  const usableHeight = Math.max(viewHeight - padding * 2, 0);
  const lastIndex = finite.length - 1;

  const coords = finite.map((value, index) => {
    const x = lastIndex === 0 ? 0 : (index / lastIndex) * viewWidth;

    // A zero range means every point is identical - draw a flat line through
    // the vertical middle rather than dividing by zero.
    const y =
      range === 0
        ? viewHeight / 2
        : viewHeight - padding - ((value - min) / range) * usableHeight;

    const safeX = Number.isFinite(x) ? x : 0;
    const safeY = Number.isFinite(y) ? y : viewHeight / 2;

    return `${safeX.toFixed(2)},${safeY.toFixed(2)}`;
  });

  return {
    points: coords.join(' '),
    flat: range === 0,
  };
}
