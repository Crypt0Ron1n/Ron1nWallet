import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { buildSparklineGeometry } from '../utils/sparklineMath';
import { Ron1nColors } from '../theme/ron1nTheme';

type Props = {
  /** Real historical price points only - never pass synthesized/fake data. */
  data: number[] | null;
  trend: 'up' | 'down' | 'flat';
  height?: number;
};

const VIEW_WIDTH = 100;

/**
 * A subtle, premium sparkline for the Syndicate market cards. Renders
 * nothing (not even a flat placeholder line) when there isn't enough real
 * data to draw one - a missing chart must never be disguised as a flat one.
 *
 * Uses a fixed SVG viewBox with preserveAspectRatio="none" so it stretches to
 * fill whatever width its parent card gives it, with no manual measurement -
 * this is what makes it responsive on Android, narrow phones, and web alike.
 */
export default function Ron1nSparkline({ data, trend, height = 36 }: Props) {
  const geometry = data ? buildSparklineGeometry(data, VIEW_WIDTH, height) : null;

  if (!geometry) {
    return null;
  }

  const color =
    trend === 'up' ? Ron1nColors.green : trend === 'down' ? Ron1nColors.danger : Ron1nColors.muted;

  return (
    <View pointerEvents="none" style={{ width: '100%', height }}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        preserveAspectRatio="none"
      >
        <Polyline
          points={geometry.points}
          fill="none"
          stroke={color}
          strokeWidth={geometry.flat ? 1 : 1.5}
          strokeOpacity={0.55}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
