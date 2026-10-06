import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Ron1nPressable from './Ron1nPressable';
import { Ron1nColors } from '../theme/ron1nTheme';
import { getAssetVisual } from '../config/assetVisuals';

type Props = {
  symbol: string;
  name: string;
  address: string;
  accent?: string;
  balance?: string;
  balanceStatus?: string;
  transactionCount?: number;
  securityLabel?: string;
  onPress: () => void;
  onRotatePress?: () => void;
  needsRotation?: boolean;
};

export default function Ron1nAssetCard({
  symbol,
  name,
  address,
  accent,
  balance,
  balanceStatus,
  transactionCount,
  securityLabel,
  onPress,
  onRotatePress,
  needsRotation,
}: Props) {
  const visual = getAssetVisual(symbol);
  const cardAccent = accent ?? visual.accent;
  const shortAddress =
    address.length > 18 ? `${address.slice(0, 10)}...${address.slice(-6)}` : address;
  const balanceText = balance !== undefined ? `${balance} ${symbol}` : 'Not synced yet';

  const statusLabel: Record<string, string> = {
    ACTIVE: 'Funded',
    EMPTY: 'No balance',
    UNFUNDED: 'Not activated',
    ERROR: 'Sync issue',
  };
  const statusText = balanceStatus ? statusLabel[balanceStatus] ?? balanceStatus : 'Not synced';

  const historyText =
    transactionCount !== undefined
      ? `${transactionCount} transaction${transactionCount === 1 ? '' : 's'}`
      : 'History not synced';

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!needsRotation) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [needsRotation, pulse]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.6] });
  const glowBorderWidth = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.5, 2.5] });

  return (
    <Ron1nPressable
      style={[
        styles.card,
        {
          borderColor: `${cardAccent}99`,
          shadowColor: cardAccent,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${symbol}`}
      accessibilityHint={`Open ${symbol} receive address`}
      accessibilityState={{ disabled: false }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[`${cardAccent}22`, `${cardAccent}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {needsRotation ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.pulseGlow,
            {
              borderColor: Ron1nColors.gold,
              opacity: glowOpacity,
              borderWidth: glowBorderWidth,
            },
          ]}
        />
      ) : null}

      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: `${cardAccent}18`,
            borderColor: `${cardAccent}99`,
          },
        ]}
        accessible
        accessibilityLabel={`${symbol} cryptocurrency logo`}
      >
        <Image source={visual.logo} style={styles.logo} />
      </View>

      <View style={styles.mid}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{name}</Text>
          <Text style={[styles.symbolInline, { color: cardAccent }]}>{symbol}</Text>
        </View>

        <Text style={styles.address} numberOfLines={1}>
          {shortAddress}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.balance}>{balanceText}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{historyText}</Text>
        </View>

        {securityLabel ? (
          <Text style={styles.securityLabel}>{securityLabel}</Text>
        ) : null}

        {needsRotation ? (
          <Text style={styles.rotationNotice}>
            Funds received — rotate recommended (network fee applies)
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        <Text style={[styles.status, { color: cardAccent }]}>{statusText}</Text>
        <View style={[styles.receiveBadge, { borderColor: cardAccent }]}>
          <Text style={[styles.action, { color: cardAccent }]}>RECEIVE</Text>
        </View>

        {onRotatePress ? (
          <TouchableOpacity
            onPress={onRotatePress}
            style={[
              styles.rotateBadge,
              { borderColor: needsRotation ? Ron1nColors.gold : '#444' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Rotate ${symbol} address`}
          >
            <Text
              style={[
                styles.action,
                { color: needsRotation ? Ron1nColors.gold : '#888' },
              ]}
            >
              ROTATE
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Ron1nPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 112,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    backgroundColor: '#0A0A0D',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  pulseGlow: {
    borderRadius: 20,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 38,
    height: 38,
    resizeMode: 'contain',
  },
  mid: {
    flex: 1,
    marginLeft: 13,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: Ron1nColors.white,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  symbolInline: {
    fontSize: 12,
    fontWeight: '900',
  },
  address: {
    color: '#C5C5D0',
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
    gap: 6,
    flexWrap: 'wrap',
  },
  balance: {
    color: Ron1nColors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  metaText: {
    color: '#C2C2CC',
    fontSize: 10,
  },
  metaDot: {
    color: '#666673',
    fontSize: 10,
  },
  securityLabel: {
    color: Ron1nColors.green,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
  },
  rotationNotice: {
    color: Ron1nColors.gold,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  status: {
    fontSize: 10,
    fontWeight: '900',
  },
  receiveBadge: {
    minWidth: 68,
    minHeight: 32,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: '#000000',
  },
  rotateBadge: {
    minWidth: 68,
    minHeight: 32,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: '#000000',
  },
  action: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
