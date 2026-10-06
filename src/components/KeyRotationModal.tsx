import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import Ron1nCard from './Ron1nCard';
import Ron1nButton from './Ron1nButton';
import Ron1nStatusBadge from './Ron1nStatusBadge';
import {
  QuantumExposureService,
  QuantumExposureRecord,
} from '../services/QuantumExposureService';
import { EvmAddressRotationService } from '../services/security/EvmAddressRotationService';
import { Ron1nColors, type Ron1nStatusTone } from '../theme/ron1nTheme';

const EXPOSURE_STATUS_TONE: Record<string, Ron1nStatusTone> = {
  SAFE: 'success',
  PROTECTED: 'success',
  WATCHLIST: 'info',
  EXPOSED: 'warning',
  ROTATION_RECOMMENDED: 'danger',
  UNKNOWN: 'neutral',
};

interface Props {
  visible: boolean;
  symbol: string;
  currentAddress: string;
  onClose: () => void;
  onSelectFreshKey: (newAddress: string) => void;
}

export default function KeyRotationModal({
  visible,
  symbol,
  currentAddress,
  onClose,
  onSelectFreshKey,
}: Props) {
  const [exposure, setExposure] = useState<QuantumExposureRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (visible && symbol) {
      loadData();
    }
  }, [visible, symbol, currentAddress]);

  const loadData = async () => {
    setLoading(true);
    try {
      const exp = await QuantumExposureService.scanAsset(symbol, currentAddress);
      setExposure(exp);
    } catch (error) {
      console.error('Failed to load key rotation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRotateNow = async () => {
    if (symbol.toUpperCase() !== 'ETH') {
      Alert.alert(
        'Not Available Yet',
        `Real address rotation (sweep + retire) is only wired up for ETH right now. ${symbol} is coming soon.`
      );
      return;
    }

    setRotating(true);

    try {
      console.log('[RON1N_ROTATE_START]', { symbol, currentAddress });

      const result = await EvmAddressRotationService.rotate(currentAddress);

      console.log('[RON1N_ROTATE_RESULT]', result);

      if (result.status === 'ROTATED_EMPTY' || result.status === 'ROTATED_SWEPT') {
        Alert.alert(
          'Address Rotated',
          `${currentAddress} is now retired and can no longer send or receive.\n\nNew active address:\n${result.newAddress}`
        );
        onSelectFreshKey(result.newAddress ?? '');
        onClose();
      } else if (result.status === 'PENDING') {
        Alert.alert(
          'Rotation Pending',
          `Sweep broadcast (${result.transactionHash}) is waiting for confirmation. The old address stays active until it confirms — check back shortly.`
        );
      } else {
        Alert.alert('Rotation Blocked', result.reason);
      }
    } catch (error) {
      console.error('[RON1N_ROTATE_ERROR]', error);
      Alert.alert(
        'Rotation Failed',
        error instanceof Error ? error.message : 'Address rotation failed unexpectedly.'
      );
    } finally {
      setRotating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>QUANTUM KEY ROTATION</Text>
          <Text style={styles.subtitle}>ASSET HYGIENE: {symbol}</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {loading ? (
              <Text style={styles.loadingText}>Scanning exposure profile...</Text>
            ) : (
              <>
                <Ron1nCard>
                  <Text style={styles.sectionHeader}>CURRENT EXPOSURE STATUS</Text>
                  <View style={styles.statusBadgeRow}>
                    <Ron1nStatusBadge
                      tone={EXPOSURE_STATUS_TONE[exposure?.status ?? 'UNKNOWN'] ?? 'neutral'}
                      label={exposure?.status ?? 'UNKNOWN'}
                    />
                  </View>
                  <Text style={styles.body}>{exposure?.recommendation}</Text>
                  <Text style={styles.metaText}>Transactions Signed: {exposure?.txCount ?? 0}</Text>
                </Ron1nCard>

                <View style={styles.spacer} />

                <View style={styles.feeNotice}>
                  <Text style={styles.feeNoticeText}>
                    Network fee applies: rotating moves your balance in a real on-chain
                    transaction, so it costs the same kind of network fee as any other send. This
                    fee is charged every single time you rotate — it is not a one-time cost.
                  </Text>
                </View>

                <Ron1nButton
                  label="ROTATE ADDRESS NOW (SWEEP + RETIRE)"
                  variant="outline"
                  icon="sync-outline"
                  busy={rotating}
                  onPress={() => void handleRotateNow()}
                  accessibilityHint="Sweeps this address's balance to a new address and permanently retires it"
                />

                <Text style={styles.rotateNowHelp}>
                  What this does: sweeps any balance on {currentAddress} to a brand new address
                  and permanently retires this one — it can never send or receive again.{'\n\n'}
                  Why: this address's public key becomes visible on-chain the moment it sends
                  anything, which permanently links everything it ever received to everything it
                  ever sends. Rotating before you send, and again right after, keeps that link
                  from ever forming and limits how long any single address's public key stays
                  exposed to a future quantum-computing attack.{'\n\n'}
                  Required before sending if this address has received funds; recommended again
                  immediately after you send. Each rotation is a separate network fee.
                </Text>
              </>
            )}
          </ScrollView>

          <View style={styles.closeButtonWrap}>
            <Ron1nButton label="CLOSE" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '85%',
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: Ron1nColors.green,
  },
  title: {
    color: Ron1nColors.gold,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    color: Ron1nColors.green,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 4,
    marginBottom: 16,
  },
  scroll: {
    paddingBottom: 20,
  },
  loadingText: {
    color: '#888',
    textAlign: 'center',
    marginVertical: 20,
  },
  sectionHeader: {
    color: Ron1nColors.blue,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  statusBadgeRow: {
    marginBottom: 8,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
  },
  metaText: {
    color: '#777',
    fontSize: 10,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  spacer: {
    height: 16,
  },
  feeNotice: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD70066',
    backgroundColor: '#FFD70012',
    borderRadius: 14,
    padding: 12,
  },
  feeNoticeText: {
    color: Ron1nColors.gold,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  rotateNowButton: {
    marginTop: 4,
    backgroundColor: '#FFD70022',
    borderColor: Ron1nColors.gold,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rotateNowButtonDisabled: {
    opacity: 0.5,
  },
  rotateNowButtonText: {
    color: Ron1nColors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rotateNowHelp: {
    color: '#888',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
  },
  closeButtonWrap: {
    marginTop: 12,
  },
});
