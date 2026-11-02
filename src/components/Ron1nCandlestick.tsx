import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { buildCandlestickGeometry, type Candle } from '../utils/candlestickMath';
import { Ron1nColors } from '../theme/ron1nTheme';

type Props = {
  /** Real OHLC candles only - never pass synthesized/fake data. */
  data: Candle[] | null;
  height?: number;
};

const VIEW_WIDTH = 100;

/**
 * A subtle 7-day daily candlestick view for the Syndicate market cards -
 * the alternate representation to Ron1nSparkline, toggled by the user.
 * Renders nothing when there isn't enough real OHLC data to draw a chart -
 * never a placeholder/fabricated candle.
 *
 * Same responsive technique as Ron1nSparkline: a fixed SVG viewBox with
 * preserveAspectRatio="none" stretches to the parent's width with no manual
 * measurement.
 */
export default function Ron1nCandlestick({ data, height = 36 }: Props) {
  const geometry = data ? buildCandlestickGeometry(data, VIEW_WIDTH, height) : null;

  if (!geometry) {
    return null;
  }

  return (
    <View pointerEvents="none" style={{ width: '100%', height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_WIDTH} ${height}`} preserveAspectRatio="none">
        {geometry.map((candle, index) => {
          const color = candle.up ? Ron1nColors.green : Ron1nColors.danger;

          return (
            <React.Fragment key={index}>
              <Line
                x1={candle.x}
                x2={candle.x}
                y1={candle.wickTop}
                y2={candle.wickBottom}
                stroke={color}
                strokeOpacity={0.55}
                strokeWidth={0.6}
              />
              <Rect
                x={candle.x - candle.bodyWidth / 2}
                y={candle.bodyTop}
                width={candle.bodyWidth}
                height={Math.max(candle.bodyBottom - candle.bodyTop, 1)}
                fill={color}
                fillOpacity={0.55}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
