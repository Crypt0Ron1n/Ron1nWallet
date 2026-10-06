import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nScreenHeader from '../components/Ron1nScreenHeader';
import Ron1nStatusBadge from '../components/Ron1nStatusBadge';
import Ron1nButton from '../components/Ron1nButton';
import Ron1nLoadingState from '../components/Ron1nLoadingState';
import { ReceiveIdentityService } from '../services/identity/ReceiveIdentityService';
import type { ShogunIdentityRecord } from '../services/identity/IdentityRegistryService';
import { AssetProtectionService, type AssetProtectionStatus } from '../services/privacy/AssetProtectionService';
import type { PrivacyAction, PrivacyLevel } from '../services/privacy/PrivacyTypes';
import type { SupportedChain } from '../services/crypto/types';
import { Ron1nColors, Ron1nSpacing, Ron1nTypography, type Ron1nStatusTone } from '../theme/ron1nTheme';

const ACCOUNT_ID = 'primary';

type ProtectableAsset = { symbol: string; name: string; chain: SupportedChain };

const PROTECTABLE_ASSETS: ProtectableAsset[] = [
  { symbol: 'ETH', name: 'Ethereum', chain: 'EVM' },
  { symbol: 'BTC', name: 'Bitcoin', chain: 'BITCOIN' },
  { symbol: 'LTC', name: 'Litecoin', chain: 'LITECOIN' },
  { symbol: 'SOL', name: 'Solana', chain: 'SOLANA' },
  { symbol: 'XRP', name: 'XRP Ledger', chain: 'XRP' },
  { symbol: 'XLM', name: 'Stellar', chain: 'STELLAR' },
  { symbol: 'ALGO', name: 'Algorand', chain: 'ALGORAND' },
];

const LEVEL_TONE: Record<PrivacyLevel, Ron1nStatusTone> = {
  PUBLIC: 'neutral',
  SEPARATED: 'info',
  PRIVATE: 'success',
  MAXIMUM_AVAILABLE: 'success',
};

const LEVEL_LABEL: Record<PrivacyLevel, string> = {
  PUBLIC: 'PUBLIC',
  SEPARATED: 'SEPARATED',
  PRIVATE: 'PRIVATE',
  MAXIMUM_AVAILABLE: 'MAXIMUM AVAILABLE',
};

function identityLine(identity: ShogunIdentityRecord | null): string {
  if (!identity) return 'Not yet created.';
  return `${identity.address}  •  ${identity.lifecycle}`;
}

export default function AssetProtectionScreen() {
  const [asset, setAsset] = useState<ProtectableAsset>(PROTECTABLE_ASSETS[0]);
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<AssetProtectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<PrivacyAction | null>(null);

  const load = useCallback(async (target: ProtectableAsset) => {
    try {
      setLoading(true);

      const receive = await ReceiveIdentityService.getOrCreateIngressIdentity(
        ACCOUNT_ID,
        target.chain,
        0
      );

      setAddress(receive.address.address);

      const next = await AssetProtectionService.getStatus(
        ACCOUNT_ID,
        target.chain,
        target.symbol,
        receive.address.address
      );

      setStatus(next);
    } catch (error) {
      console.error('Asset protection load failed:', error);
      Alert.alert('Unable To Load', 'Unable to load asset protection status.');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(asset);
  }, [asset, load]);

  useFocusEffect(
    useCallback(() => {
      void load(asset);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asset])
  );

  const handleKeep = () => {
    Alert.alert(
      'Keep As Is',
      'No changes were made. This asset continues using its current identity.'
    );
  };

  const handleSeparate = async () => {
    if (!address) return;

    try {
      setBusyAction('CREATE_FRESH_IDENTITY');

      await AssetProtectionService.createHoldingIdentity(ACCOUNT_ID, asset.chain, address);

      Alert.alert(
        'Identity Separated',
        'A fresh holding identity was reserved for this asset. No funds were moved. This reduces future address reuse - it does not make past or future ordinary transfers unlinkable.'
      );

      await load(asset);
    } catch (error) {
      Alert.alert(
        'Unable To Separate',
        error instanceof Error ? error.message : 'Unable to reserve a holding identity.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleProtect = async () => {
    try {
      setBusyAction('PRIVACY_PROTOCOL');

      const result = await AssetProtectionService.requestPrivacyProtection(asset.chain);

      Alert.alert(
        result.status === 'NOT_IMPLEMENTED' ? 'Not Implemented Yet' : 'Protection Blocked',
        result.reason
      );
    } finally {
      setBusyAction(null);
    }
  };

  const assessment = status?.assessment ?? null;

  return (
    <Ron1nScreen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Ron1nScreenHeader
          title="ASSET PROTECTION"
          subtitle="YOUR KEYS. YOUR PRIVACY. YOUR DECISION."
          accent="purple"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.assetRow}
        >
          {PROTECTABLE_ASSETS.map((item) => {
            const selected = item.symbol === asset.symbol;

            return (
              <TouchableOpacity
                key={item.symbol}
                onPress={() => setAsset(item)}
                style={[styles.assetChip, selected && styles.assetChipSelected]}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}`}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.assetChipText, selected && styles.assetChipTextSelected]}>
                  {item.symbol}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading || !assessment || !status ? (
          <Ron1nCard>
            <Ron1nLoadingState message="Loading privacy assessment…" />
          </Ron1nCard>
        ) : (
          <>
            <Ron1nCard>
              <View style={styles.levelRow}>
                <Text style={styles.cardTitle}>CURRENT EXPOSURE</Text>
                <Ron1nStatusBadge tone={LEVEL_TONE[assessment.level]} label={LEVEL_LABEL[assessment.level]} />
              </View>

              <Text style={styles.cardText}>
                {asset.name} ({asset.symbol}) received through a publicly visible{' '}
                {asset.chain} address.
              </Text>

              {assessment.explanation.map((line, index) => (
                <Text key={`explain-${index}`} style={styles.cardText}>
                  {line}
                </Text>
              ))}
            </Ron1nCard>

            <Ron1nCard>
              <Text style={styles.cardTitle}>IDENTITIES</Text>

              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>RECEIVE IDENTITY</Text>
                <Text style={styles.identityValue}>{identityLine(status.receiveIdentity)}</Text>
              </View>

              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>HOLDING IDENTITY</Text>
                <Text style={styles.identityValue}>{identityLine(status.holdingIdentity)}</Text>
              </View>

              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>SPENDING IDENTITY</Text>
                <Text style={styles.identityValue}>{identityLine(status.spendIdentity)}</Text>
              </View>
            </Ron1nCard>

            {assessment.limitations.length > 0 ? (
              <Ron1nCard>
                <Text style={styles.cardTitle}>LIMITATIONS</Text>
                {assessment.limitations.map((line, index) => (
                  <Text key={`limit-${index}`} style={styles.cardText}>
                    • {line}
                  </Text>
                ))}
              </Ron1nCard>
            ) : null}

            {assessment.recommendations.length > 0 ? (
              <Ron1nCard>
                <Text style={styles.cardTitle}>RECOMMENDATIONS</Text>
                {assessment.recommendations.map((line, index) => (
                  <Text key={`rec-${index}`} style={styles.cardText}>
                    • {line}
                  </Text>
                ))}
              </Ron1nCard>
            ) : null}

            <Ron1nCard>
              <Text style={styles.cardTitle}>YOUR DECISION</Text>

              <View style={styles.actionStack}>
                <Ron1nButton
                  label="KEEP AS IS"
                  variant="ghost"
                  onPress={handleKeep}
                  disabled={busyAction !== null}
                  accessibilityHint="Makes no changes to this asset's identity."
                />

                <Ron1nButton
                  label="SEPARATE IDENTITY"
                  variant="primary"
                  icon="git-branch-outline"
                  busy={busyAction === 'CREATE_FRESH_IDENTITY'}
                  disabled={busyAction !== null && busyAction !== 'CREATE_FRESH_IDENTITY'}
                  onPress={() => void handleSeparate()}
                  accessibilityHint="Reserves a fresh holding identity for this asset without moving funds."
                />

                <Ron1nButton
                  label="PROTECT ASSET"
                  variant="outline"
                  icon="lock-closed-outline"
                  busy={busyAction === 'PRIVACY_PROTOCOL'}
                  disabled={busyAction !== null && busyAction !== 'PRIVACY_PROTOCOL'}
                  onPress={() => void handleProtect()}
                  accessibilityHint="Checks whether a genuine privacy protocol is available for this chain."
                />
              </View>
            </Ron1nCard>
          </>
        )}
      </ScrollView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  assetRow: {
    gap: 8,
    marginBottom: 14,
  },
  assetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  assetChipSelected: {
    borderColor: 'rgba(140,0,255,0.6)',
    backgroundColor: 'rgba(140,0,255,0.16)',
  },
  assetChipText: {
    color: '#9B9BA8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  assetChipTextSelected: {
    color: Ron1nColors.white,
  },
  loadingText: {
    color: '#9B9BA8',
    fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
  },
  cardTitle: {
    color: Ron1nColors.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  cardText: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 6,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  identityRow: {
    marginBottom: 12,
  },
  identityLabel: {
    color: Ron1nColors.gray,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  identityValue: {
    color: Ron1nColors.white,
    fontSize: 11,
  },
  actionStack: {
    gap: Ron1nSpacing.sm,
    marginTop: Ron1nSpacing.sm,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  actionButtonSeparate: {
    borderColor: `${Ron1nColors.cyan}55`,
    backgroundColor: `${Ron1nColors.cyan}12`,
  },
  actionButtonProtect: {
    borderColor: `${Ron1nColors.neonPurple}55`,
    backgroundColor: `${Ron1nColors.neonPurple}12`,
  },
  actionButtonText: {
    color: Ron1nColors.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
