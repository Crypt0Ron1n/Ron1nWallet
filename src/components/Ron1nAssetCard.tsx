import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ron1nPressable from './Ron1nPressable';
import { Ron1nColors } from '../theme/ron1nTheme';

type Props = {
  symbol: string;
  name: string;
  address: string;
  accent: string;
  onPress: () => void;
};

export default function Ron1nAssetCard({ symbol, name, address, accent, onPress }: Props) {
  return (
    <Ron1nPressable style={[styles.card, { borderColor: `${accent}55` }]} onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: `${accent}22`, borderColor: `${accent}66` }]}>
        <Text style={[styles.iconText, { color: accent }]}>{symbol.slice(0, 1)}</Text>
      </View>

      <View style={styles.mid}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.address}>{address.slice(0, 12)}...{address.slice(-6)}</Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.symbol, { color: accent }]}>{symbol}</Text>
        <Text style={styles.action}>RECEIVE</Text>
      </View>
    </Ron1nPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 74,
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
    width: 46,
    height: 46,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 19,
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
    marginTop: 6,
    fontFamily: 'monospace',
  },
  right: {
    alignItems: 'flex-end',
  },
  symbol: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  action: {
    color: Ron1nColors.gray,
    fontSize: 8,
    marginTop: 7,
    fontFamily: 'KatakanaStyle',
  },
});