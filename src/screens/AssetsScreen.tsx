import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreenHeader from '../components/Ron1nScreenHeader';
import Ron1nStatusBadge from '../components/Ron1nStatusBadge';
import {
  getAssetsByCategory,
  type Ron1nAssetCategory,
  type Ron1nAssetConfig,
} from '../config/assetCatalog';
import { Ron1nColors, Ron1nSpacing, Ron1nTypography } from '../theme/ron1nTheme';

const GROUPS: { category: Ron1nAssetCategory; title: string; caption: string }[] = [
  { category: 'Native', title: 'NATIVE WALLETS', caption: 'Each has its own address and key derivation.' },
  { category: 'EVM', title: 'EVM NETWORKS', caption: 'Share your Ethereum address across EVM chains.' },
  { category: 'Token', title: 'TOKENS', caption: 'Display/send-review architecture only — Ron1n does not issue, wrap, or custody these.' },
  { category: 'Future', title: 'FUTURE NATIVE SUPPORT', caption: 'Architecture reserved — integration required before these go live.' },
];

function AssetRow({ asset }: { asset: Ron1nAssetConfig }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.symbol}>{asset.symbol}</Text>
        <Text style={styles.name}>{asset.name}</Text>
        {asset.securityLabel ? <Text style={styles.securityLabel}>{asset.securityLabel}</Text> : null}
      </View>

      <View style={styles.badgeColumn}>
        {!asset.enabledInWallet ? (
          <Ron1nStatusBadge tone="neutral" label="NOT YET AVAILABLE" />
        ) : asset.supportsBroadcast ? (
          <Ron1nStatusBadge tone="success" label="SEND READY" />
        ) : (
          <Ron1nStatusBadge tone="info" label="RECEIVE ONLY" />
        )}
      </View>
    </View>
  );
}

export default function AssetsScreen() {
  return (
    <Ron1nScreen>
      <SafeAreaView>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Ron1nScreenHeader
            title="ASSET LAYER"
            subtitle="Your assets remain yours — Ron1n adds security visibility"
            accent="gold"
          />

          {GROUPS.map((group) => {
            const assets = getAssetsByCategory(group.category);
            if (assets.length === 0) return null;

            return (
              <Ron1nCard key={group.category}>
                <Text style={styles.cardTitle}>{group.title}</Text>
                <Text style={styles.cardCaption}>{group.caption}</Text>

                <View style={styles.list}>
                  {assets.map((asset) => (
                    <AssetRow key={asset.symbol} asset={asset} />
                  ))}
                </View>
              </Ron1nCard>
            );
          })}

          <Ron1nCard>
            <Text style={styles.cardTitle}>WHAT THESE LABELS MEAN</Text>

            <View style={styles.legendRow}>
              <Ron1nStatusBadge tone="success" label="SEND READY" />
              <Text style={styles.legendText}>Balance, history, and broadcast are wired through the full security pipeline.</Text>
            </View>

            <View style={styles.legendRow}>
              <Ron1nStatusBadge tone="info" label="RECEIVE ONLY" />
              <Text style={styles.legendText}>Receive, balance, and exposure visibility work. Outbound send is not enabled yet.</Text>
            </View>

            <View style={styles.legendRow}>
              <Ron1nStatusBadge tone="neutral" label="NOT YET AVAILABLE" />
              <Text style={styles.legendText}>Display architecture only. No live balance, send, or receive yet.</Text>
            </View>
          </Ron1nCard>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </SafeAreaView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    ...Ron1nTypography.cardTitle,
    color: Ron1nColors.white,
    marginBottom: Ron1nSpacing.xs,
  },
  cardCaption: {
    ...Ron1nTypography.bodySecondary,
    color: Ron1nColors.muted,
    marginBottom: Ron1nSpacing.md,
  },
  list: {
    gap: Ron1nSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Ron1nSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C22',
  },
  rowMain: {
    flex: 1,
    paddingRight: Ron1nSpacing.sm,
  },
  symbol: {
    ...Ron1nTypography.cardTitle,
    fontSize: 14,
    color: Ron1nColors.white,
  },
  name: {
    ...Ron1nTypography.caption,
    color: Ron1nColors.gray,
    marginTop: 2,
  },
  securityLabel: {
    ...Ron1nTypography.caption,
    color: Ron1nColors.green,
    marginTop: 4,
  },
  badgeColumn: {
    alignItems: 'flex-end',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Ron1nSpacing.sm,
    marginTop: Ron1nSpacing.sm,
  },
  legendText: {
    ...Ron1nTypography.caption,
    color: Ron1nColors.muted,
    flex: 1,
  },
  bottomSpace: {
    height: 110,
  },
});
