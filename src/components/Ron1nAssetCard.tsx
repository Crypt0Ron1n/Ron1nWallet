import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
}: Props) {
  const visual = getAssetVisual(symbol);
  const cardAccent = accent ?? visual.accent;

  return (
    <Ron1nPressable style={[styles.card, { borderColor: `${cardAccent}55` }]} onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: `${cardAccent}22`, borderColor: `${cardAccent}66` }]}>
        <Text style={[styles.iconText, { color: cardAccent }]}>{visual.logoText}</Text>
      </View>

      <View style={styles.mid}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.address}>{address.slice(0, 12)}...{address.slice(-6)}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {balance !== undefined ? `${balance} ${symbol}` : 'Balance pending'}
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>
            {transactionCount !== undefined ? `${transactionCount} tx` : 'History pending'}
          </Text>
        </View>

        {securityLabel && <Text style={styles.securityLabel}>{securityLabel}</Text>}
      </View>

      <View style={styles.right}>
        <Text style={[styles.symbol, { color: cardAccent }]}>{symbol}</Text>
        <Text style={styles.status}>{balanceStatus ?? 'SYNC'}</Text>
      </View>
    </Ron1nPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 92,
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Ron1nColors.purple,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 7,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  mid: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    color: Ron1nColors.white,
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  address: {
    color: Ron1nColors.gray,
    fontSize: 11,
    marginTop: 5,
    fontFamily: 'monospace',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
    gap: 6,
  },
  metaText: {
    color: '#AAAAAA',
    fontSize: 10,
  },
  metaDot: {
    color: Ron1nColors.muted,
    fontSize: 10,
  },
  securityLabel: {
    color: Ron1nColors.green,
    fontSize: 9,
    marginTop: 7,
    fontFamily: 'KatakanaStyle',
  },
  right: {
    alignItems: 'flex-end',
  },
  symbol: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  status: {
    color: Ron1nColors.gray,
    fontSize: 8,
    marginTop: 7,
    fontFamily: 'KatakanaStyle',
  },
});